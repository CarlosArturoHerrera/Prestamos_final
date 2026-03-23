import { NextResponse } from "next/server"
import Decimal from "decimal.js"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { interesPeriodo, subDecimal, toDecimalString } from "@/lib/finance"
import { capitalPendienteFinal, siguienteVencimientoDesde } from "@/lib/prestamo-logic"
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
  const interesPeriodoActual = interesPeriodo(capitalAntes, String(prestamo.tasa_interes))
  const pagoRecibidoStr = parsed.data.pago !== undefined ? String(parsed.data.pago) : undefined
  const capitalManualStr =
    parsed.data.montoCapitalDebitado !== undefined ? String(parsed.data.montoCapitalDebitado) : undefined

  let interesCobrado = new Decimal(0)
  let capitalDebitado = new Decimal(0)
  let totalPagado = new Decimal(0)

  if (pagoRecibidoStr !== undefined) {
    const pagoRecibido = new Decimal(pagoRecibidoStr)
    if (pagoRecibido.isNegative()) {
      return badRequest("El pago no puede ser negativo")
    }
    interesCobrado = Decimal.min(new Decimal(interesPeriodoActual), pagoRecibido)
    totalPagado = pagoRecibido
    const restanteDespuesInteres = Decimal.max(new Decimal(0), pagoRecibido.minus(interesCobrado))

    if (capitalManualStr !== undefined) {
      capitalDebitado = new Decimal(capitalManualStr)
      if (capitalDebitado.gt(restanteDespuesInteres)) {
        return badRequest("El pago no cubre el capital a debitar indicado")
      }
    } else {
      capitalDebitado = restanteDespuesInteres
    }
  } else {
    capitalDebitado = new Decimal(capitalManualStr ?? "0")
    if (capitalDebitado.isNegative()) {
      return badRequest("El capital a debitar no puede ser negativo")
    }
    interesCobrado = new Decimal(interesPeriodoActual)
    totalPagado = interesCobrado.plus(capitalDebitado)
  }

  if (capitalDebitado.gt(new Decimal(capitalAntes))) {
    return badRequest("El capital a debitar no puede superar el capital pendiente")
  }

  const saldoCapitalRestante = subDecimal(capitalAntes, capitalDebitado.toFixed(2))
  const saldoFinal = capitalPendienteFinal(saldoCapitalRestante)

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
      monto_capital_debitado: capitalDebitado.toFixed(2),
      interes_cobrado: interesCobrado.toFixed(2),
      total_pagado: totalPagado.toFixed(2),
      pago_recibido: pagoRecibidoStr ? toDecimalString(pagoRecibidoStr) : null,
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

  const interesPendiente = new Decimal(interesPeriodoActual).minus(interesCobrado)
  if (interesPendiente.gt(0)) {
    const fechaRef = parsed.data.fechaAbono
    const { data: existing } = await supabase
      .from("intereses_atrasados")
      .select("id")
      .eq("prestamo_id", id)
      .eq("fecha_generado", fechaRef)
      .eq("aplicado", false)
      .maybeSingle()

    if (!existing) {
      await supabase.from("intereses_atrasados").insert({
        prestamo_id: id,
        fecha_generado: fechaRef,
        monto: interesPendiente.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        aplicado: false,
      })
    }
  }

  return NextResponse.json(abono)
}
