import { NextResponse } from "next/server"
import { badRequest, forbidden, getUserAndRole, requireAdmin, unauthorized } from "@/lib/api-auth"
import { generarInteresesAtrasadosSiCorresponde } from "@/lib/prestamo-logic"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { z } from "zod"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  const { data: p, error } = await supabase
    .from("prestamos")
    .select(
      `
      *,
      clientes (
        id, nombre, apellido, cedula, telefono,
        representantes ( id, nombre, apellido, telefono, email ),
        empresas ( id, nombre )
      )
    `,
    )
    .eq("id", id)
    .single()

  if (error || !p) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  await generarInteresesAtrasadosSiCorresponde(supabase, p)

  const { data: refreshed } = await supabase.from("prestamos").select("*").eq("id", id).single()

  const { data: abonos } = await supabase
    .from("abonos")
    .select("*")
    .eq("prestamo_id", id)
    .order("fecha_abono", { ascending: false })
    .order("created_at", { ascending: false })

  const { data: intereses } = await supabase
    .from("intereses_atrasados")
    .select("*")
    .eq("prestamo_id", id)
    .order("created_at", { ascending: false })

  const { data: reganches } = await supabase
    .from("reganches")
    .select("*")
    .eq("prestamo_id", id)
    .order("created_at", { ascending: false })

  return NextResponse.json({
    prestamo: refreshed ?? p,
    abonos: abonos ?? [],
    intereses_atrasados: intereses ?? [],
    reganches: reganches ?? [],
  })
}

const putSchema = z.object({
  notas: z.string().max(5000).optional().nullable(),
  estado: z.enum(["ACTIVO", "SALDADO", "MORA"]).optional(),
})

export async function PUT(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  if (parsed.data.estado && !requireAdmin(session.role)) {
    return forbidden()
  }

  const payload: Record<string, unknown> = {}
  if (parsed.data.notas !== undefined) payload.notas = parsed.data.notas?.trim() || null
  if (parsed.data.estado) payload.estado = parsed.data.estado

  if (Object.keys(payload).length === 0) {
    return badRequest("Nada que actualizar")
  }

  const { data, error } = await supabase.from("prestamos").update(payload).eq("id", id).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
