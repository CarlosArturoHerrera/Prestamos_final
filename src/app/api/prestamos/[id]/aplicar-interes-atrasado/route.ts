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
    .eq("estado", "PENDIENTE")

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
    (acc, row) => acc.plus(String(row.interes_pendiente ?? row.monto)),
    new Decimal(0),
  )

  if (total.lte(0)) {
    return badRequest("No hay interés pendiente para aplicar al capital")
  }

  const capitalAntes = String(prestamo.capital_pendiente)
  const nuevoCapital = sumDecimal(capitalAntes, total.toFixed(2))
  const hoy = new Date().toISOString().slice(0, 10)

  const ids = pendientes.map((p) => p.id)

  const snapshots = pendientes.map((row) => ({
    id: row.id as number,
    aplicado: Boolean(row.aplicado),
    fecha_aplicado: row.fecha_aplicado as string | null,
    estado: String(row.estado ?? "PENDIENTE"),
    interes_pendiente: String(row.interes_pendiente ?? row.monto ?? "0"),
    monto: String(row.monto ?? row.interes_pendiente ?? "0"),
    interes_pagado: String(row.interes_pagado ?? "0"),
    interes_generado: String(row.interes_generado ?? "0"),
    origen_capitalizacion: (row.origen_capitalizacion as string | null) ?? null,
  }))

  const restoreIntereses = async () => {
    for (const s of snapshots) {
      await supabase
        .from("intereses_atrasados")
        .update({
          aplicado: s.aplicado,
          fecha_aplicado: s.fecha_aplicado,
          estado: s.estado,
          interes_pendiente: s.interes_pendiente,
          monto: s.monto,
          interes_pagado: s.interes_pagado,
          interes_generado: s.interes_generado,
          origen_capitalizacion: s.origen_capitalizacion,
        })
        .eq("id", s.id)
    }
  }

  const { error: ue } = await supabase
    .from("intereses_atrasados")
    .update({
      aplicado: true,
      fecha_aplicado: hoy,
      estado: "CAPITALIZADO",
      interes_pendiente: "0.00",
      monto: "0.00",
      origen_capitalizacion: "MANUAL",
    })
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
    await restoreIntereses()
    return NextResponse.json({ error: pe2.message }, { status: 400 })
  }

  const { error: re } = await supabase.from("reganches").insert({
    prestamo_id: id,
    monto_agregado: total.toFixed(2),
    notas: `MANUAL: Capitalización interés pendiente (${ids.length} período(s))`,
  })

  if (re) {
    await supabase.from("prestamos").update({ capital_pendiente: capitalAntes }).eq("id", id)
    await restoreIntereses()
    return NextResponse.json({ error: re.message }, { status: 400 })
  }

  return NextResponse.json({ prestamo: updated, aplicados: ids })
}
