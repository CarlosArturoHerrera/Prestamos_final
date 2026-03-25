import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { gestionCobranzaCreateSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const clienteId = Number(idParam)
  if (!Number.isFinite(clienteId)) return badRequest("ID inválido")

  const { data: existe } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle()
  if (!existe) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("gestion_cobranza")
    .select(
      `
      *,
      prestamos ( id, estado, capital_pendiente )
    `,
    )
    .eq("cliente_id", clienteId)
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
  const clienteId = Number(idParam)
  if (!Number.isFinite(clienteId)) return badRequest("ID inválido")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = gestionCobranzaCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { notas, promesaMonto, promesaFecha, proximaFechaContacto, resultado, prestamoId } = parsed.data

  const { data: clienteRow, error: eCli } = await supabase.from("clientes").select("id").eq("id", clienteId).single()
  if (eCli || !clienteRow) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  }

  let prestamoIdFinal: number | null = prestamoId ?? null
  if (prestamoIdFinal != null) {
    const { data: pr, error: ePr } = await supabase
      .from("prestamos")
      .select("id, cliente_id")
      .eq("id", prestamoIdFinal)
      .single()
    if (ePr || !pr || pr.cliente_id !== clienteId) {
      return badRequest("El préstamo no pertenece a este cliente")
    }
  }

  const insert = {
    cliente_id: clienteId,
    prestamo_id: prestamoIdFinal,
    notas: (notas ?? "").trim(),
    promesa_monto: promesaMonto != null ? Number(promesaMonto) : null,
    promesa_fecha: promesaFecha ?? null,
    proxima_fecha_contacto: proximaFechaContacto ?? null,
    resultado,
    creado_por: session.userId,
  }

  const { data: row, error } = await supabase.from("gestion_cobranza").insert(insert).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(row, { status: 201 })
}
