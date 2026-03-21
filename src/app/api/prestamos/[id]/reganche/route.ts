import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { sumDecimal } from "@/lib/finance"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { regancheSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

/** Reganche en el mismo préstamo: aumenta monto total y capital pendiente. */
export async function POST(request: Request, ctx: Ctx) {
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

  const parsed = regancheSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { data: prestamo, error: pe } = await supabase.from("prestamos").select("*").eq("id", id).single()

  if (pe || !prestamo) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  if (prestamo.estado === "SALDADO") {
    return badRequest("No se puede reganchar un préstamo saldado")
  }

  const agregado = String(parsed.data.montoAgregado)
  const nuevoMonto = sumDecimal(String(prestamo.monto), agregado)
  const nuevoCapital = sumDecimal(String(prestamo.capital_pendiente), agregado)

  const { error: re } = await supabase.from("reganches").insert({
    prestamo_id: id,
    monto_agregado: agregado,
    notas: parsed.data.notas?.trim() || null,
  })

  if (re) {
    return NextResponse.json({ error: re.message }, { status: 400 })
  }

  const { data: updated, error: ue } = await supabase
    .from("prestamos")
    .update({
      monto: nuevoMonto,
      capital_pendiente: nuevoCapital,
    })
    .eq("id", id)
    .select()
    .single()

  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 400 })
  }

  return NextResponse.json(updated)
}
