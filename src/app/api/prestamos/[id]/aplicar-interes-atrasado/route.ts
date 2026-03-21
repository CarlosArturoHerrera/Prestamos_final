import { NextResponse } from "next/server"
import Decimal from "decimal.js"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { sumDecimal } from "@/lib/finance"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { z } from "zod"

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).optional(),
})

/** Suma al capital los intereses atrasados pendientes seleccionados (o todos los pendientes). */
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  let body: unknown = {}
  try {
    const t = await request.text()
    if (t) body = JSON.parse(t)
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { data: prestamo, error: pe } = await supabase.from("prestamos").select("*").eq("id", id).single()

  if (pe || !prestamo) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  let q = supabase
    .from("intereses_atrasados")
    .select("*")
    .eq("prestamo_id", id)
    .eq("aplicado", false)

  if (parsed.data.ids?.length) {
    q = q.in("id", parsed.data.ids)
  }

  const { data: pendientes, error: ie } = await q

  if (ie) {
    return NextResponse.json({ error: ie.message }, { status: 400 })
  }

  if (!pendientes?.length) {
    return badRequest("No hay intereses atrasados pendientes para aplicar")
  }

  const total = pendientes.reduce(
    (acc, row) => acc.plus(String(row.monto)),
    new Decimal(0),
  )

  const nuevoCapital = sumDecimal(String(prestamo.capital_pendiente), total.toFixed(2))
  const hoy = new Date().toISOString().slice(0, 10)

  const ids = pendientes.map((p) => p.id)

  const { error: ue } = await supabase
    .from("intereses_atrasados")
    .update({ aplicado: true, fecha_aplicado: hoy })
    .in("id", ids)

  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 400 })
  }

  const { data: updated, error: pe2 } = await supabase
    .from("prestamos")
    .update({ capital_pendiente: nuevoCapital })
    .eq("id", id)
    .select()
    .single()

  if (pe2) {
    return NextResponse.json({ error: pe2.message }, { status: 400 })
  }

  return NextResponse.json({ prestamo: updated, aplicados: ids })
}
