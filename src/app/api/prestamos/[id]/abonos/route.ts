import { NextResponse } from "next/server"
import Decimal from "decimal.js"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import {
  calcularAbono,
  capitalPendienteFinal,
  siguienteVencimientoDesde,
} from "@/lib/prestamo-logic"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { abonoCreateSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  const { data, error } = await supabase
    .from("abonos")
    .select("*")
    .eq("prestamo_id", id)
    .order("fecha_abono", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data: data ?? [] })
}

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

  const parsed = abonoCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { data: prestamo, error: pe } = await supabase.from("prestamos").select("*").eq("id", id).single()

  if (pe || !prestamo) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 })
  }

  if (prestamo.estado === "SALDADO") {
    return badRequest("El préstamo ya está saldado")
  }

  const capitalAntes = String(prestamo.capital_pendiente)
  const montoCap = String(parsed.data.montoCapitalDebitado)

  if (new Decimal(montoCap).gt(capitalAntes)) {
    return badRequest("El capital a debitar no puede superar el capital pendiente")
  }

  const { interes_cobrado, total_pagado, saldo_capital_restante } = calcularAbono(
    capitalAntes,
    String(prestamo.tasa_interes),
    montoCap,
  )

  const saldoFinal = capitalPendienteFinal(saldo_capital_restante)
  const nuevoEstado =
    new Decimal(saldoFinal).lte(0) ? "SALDADO" : prestamo.estado === "MORA" ? "ACTIVO" : prestamo.estado

  const nuevaFechaProximo =
    new Decimal(saldoFinal).lte(0)
      ? prestamo.fecha_proximo_vencimiento
      : siguienteVencimientoDesde(String(prestamo.fecha_proximo_vencimiento), prestamo.tipo_plazo)

  const { data: abono, error: ae } = await supabase
    .from("abonos")
    .insert({
      prestamo_id: id,
      fecha_abono: parsed.data.fechaAbono,
      monto_capital_debitado: montoCap,
      interes_cobrado,
      total_pagado,
      saldo_capital_restante: saldoFinal,
      observaciones: parsed.data.observaciones?.trim() || null,
    })
    .select()
    .single()

  if (ae) {
    return NextResponse.json({ error: ae.message }, { status: 400 })
  }

  const { error: ue } = await supabase
    .from("prestamos")
    .update({
      capital_pendiente: saldoFinal,
      fecha_proximo_vencimiento: nuevaFechaProximo,
      estado: nuevoEstado === "SALDADO" ? "SALDADO" : nuevoEstado,
    })
    .eq("id", id)

  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 400 })
  }

  const { error: ce } = await supabase
    .from("clientes")
    .update({ ultimo_pago: parsed.data.fechaAbono })
    .eq("id", prestamo.cliente_id)

  if (ce) {
    return NextResponse.json({ error: ce.message }, { status: 400 })
  }

  return NextResponse.json(abono)
}
