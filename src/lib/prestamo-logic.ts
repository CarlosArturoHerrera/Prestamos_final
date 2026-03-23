import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays } from "date-fns"
import Decimal from "decimal.js"
import {
  addPeriod,
  fechaVencimientoFinal,
  interesPeriodo,
  primeraCuota,
  subDecimal,
  sumDecimal,
  toDecimalString,
  type TipoPlazo,
} from "@/lib/finance"

export type EstadoInteresPendiente = "PENDIENTE" | "PAGADO" | "CAPITALIZADO" | "ANULADO"

export async function upsertInteresPendientePeriodo(
  supabase: SupabaseClient,
  {
    prestamoId,
    fechaPeriodo,
    interesGenerado,
    interesPagadoIncremental,
  }: {
    prestamoId: number
    fechaPeriodo: string
    interesGenerado: string
    interesPagadoIncremental: string
  },
): Promise<void> {
  const { data: existing, error: ee } = await supabase
    .from("intereses_atrasados")
    .select("*")
    .eq("prestamo_id", prestamoId)
    .eq("fecha_periodo", fechaPeriodo)
    .maybeSingle()

  if (ee) return

  const generado = new Decimal(interesGenerado)
  const pagadoInc = new Decimal(interesPagadoIncremental)

  if (!existing) {
    const pagado = Decimal.min(generado, pagadoInc)
    const pendiente = Decimal.max(new Decimal(0), generado.minus(pagado))
    const estado: EstadoInteresPendiente = pendiente.gt(0) ? "PENDIENTE" : "PAGADO"
    await supabase.from("intereses_atrasados").insert({
      prestamo_id: prestamoId,
      fecha_generado: fechaPeriodo,
      fecha_periodo: fechaPeriodo,
      monto: pendiente.toFixed(2),
      interes_generado: generado.toFixed(2),
      interes_pagado: pagado.toFixed(2),
      interes_pendiente: pendiente.toFixed(2),
      estado,
      aplicado: false,
      fecha_aplicado: null,
    })
    return
  }

  const estadoActual = String(existing.estado ?? "PENDIENTE") as EstadoInteresPendiente
  if (estadoActual === "ANULADO" || estadoActual === "CAPITALIZADO") {
    return
  }
  if (estadoActual === "PAGADO" && pagadoInc.lte(0)) {
    return
  }

  const pagadoActual = new Decimal(String(existing.interes_pagado ?? 0))
  const pagadoNuevo = Decimal.min(generado, pagadoActual.plus(pagadoInc))
  const pendienteNuevo = Decimal.max(new Decimal(0), generado.minus(pagadoNuevo))
  const estadoNuevo: EstadoInteresPendiente = pendienteNuevo.gt(0) ? "PENDIENTE" : "PAGADO"

  await supabase
    .from("intereses_atrasados")
    .update({
      fecha_generado: fechaPeriodo,
      interes_generado: generado.toFixed(2),
      interes_pagado: pagadoNuevo.toFixed(2),
      interes_pendiente: pendienteNuevo.toFixed(2),
      monto: pendienteNuevo.toFixed(2),
      estado: estadoNuevo,
      aplicado: false,
      fecha_aplicado: null,
    })
    .eq("id", existing.id)
}

export async function generarInteresesAtrasadosSiCorresponde(
  supabase: SupabaseClient,
  prestamo: Record<string, unknown>,
): Promise<void> {
  if (prestamo.estado === "SALDADO") return

  const id = prestamo.id as number
  const fechaProx = String(prestamo.fecha_proximo_vencimiento)
  const capital = String(prestamo.capital_pendiente)
  const tasa = String(prestamo.tasa_interes)

  const hoy = new Date()
  const proximo = new Date(`${fechaProx}T12:00:00`)
  const limiteMora = addDays(proximo, 3)
  // Cuando llega o pasa el período, se registra el interés generado como pendiente
  // (si no se ha cubierto aún con abonos). Nunca se capitaliza automáticamente.
  if (hoy >= proximo) {
    const monto = interesPeriodo(capital, tasa)
    await upsertInteresPendientePeriodo(supabase, {
      prestamoId: id,
      fechaPeriodo: fechaProx,
      interesGenerado: monto,
      interesPagadoIncremental: "0.00",
    })
  }

  if (hoy > limiteMora) {
    await supabase.from("prestamos").update({ estado: "MORA" }).eq("id", id)
  }
}

export function calcularFechasNuevoPrestamo(
  fechaInicioStr: string,
  tipoPlazo: TipoPlazo,
  plazo: number,
) {
  const fechaInicio = new Date(`${fechaInicioStr}T12:00:00`)
  const fp = primeraCuota(fechaInicio, tipoPlazo)
  const fv = fechaVencimientoFinal(fechaInicio, tipoPlazo, plazo)
  return {
    fecha_proximo_vencimiento: fp.toISOString().slice(0, 10),
    fecha_vencimiento: fv.toISOString().slice(0, 10),
  }
}

export function siguienteVencimientoDesde(actual: string, tipoPlazo: TipoPlazo): string {
  const d = new Date(`${actual}T12:00:00`)
  const n = addPeriod(d, tipoPlazo, 1)
  return n.toISOString().slice(0, 10)
}

export function calcularAbono(
  capitalAntes: string,
  tasaPorcentaje: string,
  montoCapitalDebitado: string,
) {
  const interes = interesPeriodo(capitalAntes, tasaPorcentaje)
  const total = sumDecimal(interes, montoCapitalDebitado)
  const saldo = subDecimal(capitalAntes, montoCapitalDebitado)
  return { interes_cobrado: interes, total_pagado: total, saldo_capital_restante: saldo }
}

export function capitalPendienteFinal(saldo: string): string {
  const s = Number.parseFloat(saldo)
  if (s < 0) return "0.00"
  return toDecimalString(saldo)
}

/**
 * Proyección para la próxima cuota (listado / referencia):
 * - Interés del período sobre el capital pendiente actual.
 * - Capital sugerido a debitar: capital restante repartido en las cuotas que faltan (plazo − abonos, mínimo 1).
 * - Total próximo pago = interés + ese capital.
 */
export function proyectarProximaCuota(
  capitalPendiente: string,
  tasaPorcentaje: string,
  plazo: number,
  abonosCount: number,
  estado: string,
): {
  interesProximo: string
  capitalDebitarSugerido: string
  totalProximoPago: string
} {
  if (estado === "SALDADO" || new Decimal(capitalPendiente).lte(0)) {
    return {
      interesProximo: "0.00",
      capitalDebitarSugerido: "0.00",
      totalProximoPago: "0.00",
    }
  }
  const interesProximo = interesPeriodo(capitalPendiente, tasaPorcentaje)
  const cuotasRestantes = Math.max(1, plazo - abonosCount)
  const capitalDebitarSugerido = new Decimal(capitalPendiente)
    .div(cuotasRestantes)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2)
  const totalProximoPago = sumDecimal(interesProximo, capitalDebitarSugerido)
  return { interesProximo, capitalDebitarSugerido, totalProximoPago }
}

/** Cuenta de abonos embebida en select `abonos(count)` de Supabase. */
export function abonosCountFromRow(row: { abonos?: { count?: number }[] | null }): number {
  const a = row.abonos
  if (!a?.length) return 0
  const c = a[0]?.count
  return typeof c === "number" ? c : 0
}
