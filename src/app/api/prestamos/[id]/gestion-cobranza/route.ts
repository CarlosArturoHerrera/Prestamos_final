import { NextResponse } from "next/server"
import { badRequest, ensureProfileRow, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { gestionCobranzaCreateSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const prestamoId = Number(idParam)
  if (!Number.isFinite(prestamoId)) return badRequest("ID inválido")

  const { data: pr } = await supabase.from("prestamos").select("id").eq("id", prestamoId).maybeSingle()
  if (!pr) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("gestion_cobranza")
    .select("*")
    .eq("prestamo_id", prestamoId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const prestamoId = Number(idParam)
  if (!Number.isFinite(prestamoId)) return badRequest("ID inválido")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = gestionCobranzaCreateSchema.omit({ prestamoId: true }).safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { notas, promesaMonto, promesaFecha, proximaFechaContacto, resultado } = parsed.data

  const { data: pr, error: ePr } = await supabase.from("prestamos").select("id, cliente_id").eq("id", prestamoId).single()
  if (ePr || !pr) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  const profileOk = await ensureProfileRow(supabase, session.userId, session.role)
  const insert = {
    cliente_id: pr.cliente_id,
    prestamo_id: prestamoId,
    notas: (notas ?? "").trim(),
    promesa_monto: promesaMonto != null ? Number(promesaMonto) : null,
    promesa_fecha: promesaFecha ?? null,
    proxima_fecha_contacto: proximaFechaContacto ?? null,
    resultado,
    creado_por: profileOk ? session.userId : null,
  }

  console.log("session.userId", session.userId, "creado_por final", insert.creado_por)

  const { data: row, error } = await supabase.from("gestion_cobranza").insert(insert).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(row, { status: 201 })
}
