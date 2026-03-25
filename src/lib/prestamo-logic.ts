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
  // CAPITALIZADO/ANULADO: período cerrado; no mezclar nuevos abonos con esta fila (trazabilidad en tabla abonos).
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
  // Si ya venció el período, se registra el interés generado como pendiente (si aplica).
  // La capitalización al capital tras +3 días sin cubrir el interés la aplica
  // `capitalizarInteresPendienteAutomaticoSiCorresponde` al cargar el detalle (u otras rutas que la invoquen).
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

/**
 * Tras la fecha de pago del período + 3 días calendario, si sigue habiendo interés pendiente
 * sin cubrir, suma ese monto al capital y marca el registro como CAPITALIZADO (origen AUTO).
 * Idempotente: solo actualiza filas en estado PENDIENTE; no duplica si se ejecuta varias veces.
 * Deja auditoría en `reganches` (monto agregado al capital) y en la fila de `intereses_atrasados`.
 */
export async function capitalizarInteresPendienteAutomaticoSiCorresponde(
  supabase: SupabaseClient,
  prestamo: Record<string, unknown>,
): Promise<void> {
  if (prestamo.estado === "SALDADO") return

  const id = prestamo.id as number
  const fechaHoy = new Date().toISOString().slice(0, 10)

  const { data: pendientes, error } = await supabase
    .from("intereses_atrasados")
    .select("*")
    .eq("prestamo_id", id)
    .eq("estado", "PENDIENTE")

  if (error || !pendientes?.length) return

  const ordenados = [...pendientes].sort((a, b) => {
    const fa = String(a.fecha_periodo ?? a.fecha_generado ?? "")
    const fb = String(b.fecha_periodo ?? b.fecha_generado ?? "")
    return fa.localeCompare(fb)
  })

  let capitalActual = String(prestamo.capital_pendiente)

  for (const row of ordenados) {
    const fp = String(row.fecha_periodo ?? row.fecha_generado ?? "")
    if (!fp || fp.length < 10) continue

    const pendiente = new Decimal(String(row.interes_pendiente ?? row.monto ?? 0))
    if (pendiente.lte(0)) continue

    const limiteStr = addDays(new Date(`${fp.slice(0, 10)}T12:00:00`), 3).toISOString().slice(0, 10)
    if (fechaHoy <= limiteStr) continue

    const monto = pendiente.toFixed(2)
    const nuevoCapital = sumDecimal(capitalActual, monto)

    const snap = {
      estado: String(row.estado ?? "PENDIENTE"),
      interes_pendiente: String(row.interes_pendiente ?? row.monto ?? "0"),
      monto: String(row.monto ?? row.interes_pendiente ?? "0"),
      interes_pagado: String(row.interes_pagado ?? "0"),
      interes_generado: String(row.interes_generado ?? "0"),
      aplicado: Boolean(row.aplicado),
      fecha_aplicado: row.fecha_aplicado as string | null,
      origen_capitalizacion: (row.origen_capitalizacion as string | null) ?? null,
    }

    const { data: tocado, error: uerr } = await supabase
      .from("intereses_atrasados")
      .update({
        aplicado: true,
        fecha_aplicado: fechaHoy,
        estado: "CAPITALIZADO",
        interes_pendiente: "0.00",
        monto: "0.00",
        origen_capitalizacion: "AUTO",
      })
      .eq("id", row.id)
      .eq("estado", "PENDIENTE")
      .select("id")
      .maybeSingle()

    if (uerr || !tocado) continue

    const { error: pe } = await supabase
      .from("prestamos")
      .update({ capital_pendiente: nuevoCapital })
      .eq("id", id)

    if (pe) {
      await supabase
        .from("intereses_atrasados")
        .update({
          estado: snap.estado,
          interes_pendiente: snap.interes_pendiente,
          monto: snap.monto,
          interes_pagado: snap.interes_pagado,
          interes_generado: snap.interes_generado,
          aplicado: snap.aplicado,
          fecha_aplicado: snap.fecha_aplicado,
          origen_capitalizacion: snap.origen_capitalizacion,
        })
        .eq("id", row.id)
      continue
    }

    capitalActual = nuevoCapital

    await supabase.from("reganches").insert({
      prestamo_id: id,
      monto_agregado: monto,
      notas: `AUTO: Capitalización automática — interés pendiente período ${fp.slice(0, 10)} (interés #${row.id})`,
    })
  }
}

/**
 * Ejecuta en bucle (máx. 3) generación de interés pendiente + capitalización automática,
 * recargando el préstamo entre vueltas. Tras capitalizar, sube el capital y el interés del
 * período debe recalcularse antes de una nueva pasada (evita montos incoherentes en detalle).
 */
export async function sincronizarInteresesYCapitalizacionAuto(
  supabase: SupabaseClient,
  prestamo: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = prestamo.id as number
  let current: Record<string, unknown> = prestamo
  for (let i = 0; i < 3; i++) {
    await generarInteresesAtrasadosSiCorresponde(supabase, current)
    await capitalizarInteresPendienteAutomaticoSiCorresponde(supabase, current)
    const { data } = await supabase.from("prestamos").select("*").eq("id", id).single()
    if (!data) return current
    current = data
  }
  return current
}

/**
 * Listado `/prestamos`: solo hace falta sincronizar préstamos que podrían haber cambiado sin abrir el detalle:
 * - en MORA, o
 * - con próximo vencimiento ya alcanzado (hoy ≥ fecha), donde pueden correr generación de interés / capitalización AUTO.
 * Préstamos ACTIVO con vencimiento futuro no tocan BD aquí.
 */
export function prestamoPodriaRequerirSyncLista(
  prestamo: Record<string, unknown>,
  hoyIso: string,
): boolean {
  if (String(prestamo.estado) === "SALDADO") return false
  if (String(prestamo.estado) === "MORA") return true
  const fp = String(prestamo.fecha_proximo_vencimiento ?? "")
  if (fp.length < 10) return false
  return fp <= hoyIso
}

/**
 * Aplica `sincronizarInteresesYCapitalizacionAuto` solo a filas candidatas, en lotes paralelos acotados,
 * y actualiza los objetos en memoria para que el listado proyecte cuotas con capital/estado actuales.
 */
export async function sincronizarPrestamosListadoSiCorresponde(
  supabase: SupabaseClient,
  filas: Record<string, unknown>[],
): Promise<void> {
  const hoyIso = new Date().toISOString().slice(0, 10)
  const candidatos = filas.filter((r) => prestamoPodriaRequerirSyncLista(r, hoyIso))
  const CONCURRENCY = 4
  for (let i = 0; i < candidatos.length; i += CONCURRENCY) {
    const chunk = candidatos.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async (row) => {
        const merged = await sincronizarInteresesYCapitalizacionAuto(supabase, row)
        const id = row.id as number
        const target = filas.find((r) => (r.id as number) === id)
        if (!target) return
        Object.assign(target, {
          capital_pendiente: merged.capital_pendiente,
          estado: merged.estado,
          fecha_proximo_vencimiento: merged.fecha_proximo_vencimiento,
          monto: merged.monto,
        })
      }),
    )
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
