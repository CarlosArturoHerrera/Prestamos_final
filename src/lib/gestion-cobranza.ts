/** Valores alineados con el enum `resultado_gestion_cobranza` en la base de datos. */
export const RESULTADOS_GESTION_COBRANZA = [
  "CONTACTADO",
  "NO_RESPONDE",
  "PAGARA_HOY",
  "PAGARA_DESPUES",
  "RENEGOCIACION",
  "PROMESA_CUMPLIDA",
  "PROMESA_INCUMPLIDA",
  "OTRO",
] as const

export type ResultadoGestionCobranza = (typeof RESULTADOS_GESTION_COBRANZA)[number]

export const RESULTADO_GESTION_LABELS: Record<ResultadoGestionCobranza, string> = {
  CONTACTADO: "Contactado",
  NO_RESPONDE: "No responde",
  PAGARA_HOY: "Pagará hoy",
  PAGARA_DESPUES: "Pagará después",
  RENEGOCIACION: "Renegociación",
  PROMESA_CUMPLIDA: "Promesa cumplida",
  PROMESA_INCUMPLIDA: "Promesa incumplida",
  OTRO: "Otro",
}

export function labelResultadoGestion(codigo: string): string {
  const u = codigo.toUpperCase() as ResultadoGestionCobranza
  return RESULTADO_GESTION_LABELS[u] ?? codigo
}
