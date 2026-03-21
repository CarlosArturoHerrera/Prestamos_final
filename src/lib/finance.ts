import Decimal from "decimal.js"
import { addDays, addMonths, addWeeks } from "date-fns"

export type TipoPlazo = "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL"

/** Suma n períodos desde fecha (cada período según tipo). */
export function addPeriod(fecha: Date, tipo: TipoPlazo, periodos = 1): Date {
  let d = fecha
  for (let i = 0; i < periodos; i++) {
    switch (tipo) {
      case "DIARIO":
        d = addDays(d, 1)
        break
      case "SEMANAL":
        d = addWeeks(d, 1)
        break
      case "QUINCENAL":
        d = addDays(d, 15)
        break
      case "MENSUAL":
        d = addMonths(d, 1)
        break
      default:
        break
    }
  }
  return d
}

/** Primera fecha de cuota: inicio + 1 período. */
export function primeraCuota(fechaInicio: Date, tipo: TipoPlazo): Date {
  return addPeriod(fechaInicio, tipo, 1)
}

/** Fecha de la última cuota del contrato: inicio + plazo períodos (plazo = número de cuotas). */
export function fechaVencimientoFinal(fechaInicio: Date, tipo: TipoPlazo, plazo: number): Date {
  return addPeriod(fechaInicio, tipo, plazo)
}

/** Interés del período: capitalPendiente * (tasaPorcentaje / 100). */
export function interesPeriodo(capitalPendiente: string, tasaPorcentaje: string): string {
  const c = new Decimal(capitalPendiente)
  const t = new Decimal(tasaPorcentaje).div(100)
  return c.mul(t).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function toDecimalString(value: string | number): string {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function sumDecimal(a: string, b: string): string {
  return new Decimal(a).plus(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function subDecimal(a: string, b: string): string {
  return new Decimal(a).minus(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

/** Días de atraso respecto a una fecha límite (solo si hoy > límite). */
export function diasAtrasoDesde(hoy: Date, fechaLimite: Date): number {
  const ms = hoy.setHours(0, 0, 0, 0) - fechaLimite.setHours(0, 0, 0, 0)
  if (ms <= 0) return 0
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
