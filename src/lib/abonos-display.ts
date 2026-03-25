import { formatRD } from "@/lib/format-currency"

/** Columna actual `interes_recibido`; respaldo `pago_recibido` si hubiera datos previos al rename. */
export function getInteresRecibidoFromAbono(row: Record<string, unknown>): string | null {
  const ir = row.interes_recibido
  if (ir != null && String(ir).trim() !== "") return String(ir)
  const legacy = row.pago_recibido
  if (legacy != null && String(legacy).trim() !== "") return String(legacy)
  return null
}

/** Monto numérico conocido → RD$; ausente o vacío → "—". */
export function formatMontoAbonoOGuion(value: unknown): string {
  if (value == null) return "—"
  const s = String(value).trim()
  if (s === "") return "—"
  return formatRD(s)
}
