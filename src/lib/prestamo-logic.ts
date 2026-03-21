import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays } from "date-fns"
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

  if (hoy <= limiteMora) return

  const monto = interesPeriodo(capital, tasa)

  const { data: existing } = await supabase
    .from("intereses_atrasados")
    .select("id")
    .eq("prestamo_id", id)
    .eq("fecha_generado", fechaProx)
    .eq("aplicado", false)
    .maybeSingle()

  if (existing) {
    await supabase.from("prestamos").update({ estado: "MORA" }).eq("id", id)
    return
  }

  await supabase.from("intereses_atrasados").insert({
    prestamo_id: id,
    fecha_generado: fechaProx,
    monto,
    aplicado: false,
  })

  await supabase.from("prestamos").update({ estado: "MORA" }).eq("id", id)
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
