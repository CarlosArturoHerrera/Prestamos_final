import { NextResponse } from "next/server"
import { addDays, format, subDays } from "date-fns"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** Métricas agregadas del portafolio y alertas operativas (sin filtros de listado). */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const todayStr = format(hoy, "yyyy-MM-dd")
  const plus7Str = format(addDays(hoy, 7), "yyyy-MM-dd")
  const desde7d = subDays(new Date(), 7).toISOString()

  const [
    { data: prestamos },
    { data: interesesPend },
    { data: autoRegs },
    { data: manRegs },
    { count: moraCount },
    { count: saldadosCount },
    { count: activosCount },
    { count: vencenProximos7 },
    { data: interesPrestamoRows },
    { count: capAuto7d },
  ] = await Promise.all([
    supabase.from("prestamos").select("monto, capital_pendiente, estado"),
    supabase.from("intereses_atrasados").select("interes_pendiente, monto, estado").eq("estado", "PENDIENTE"),
    supabase.from("reganches").select("monto_agregado").like("notas", "AUTO:%"),
    supabase.from("reganches").select("monto_agregado").like("notas", "MANUAL:%"),
    supabase.from("prestamos").select("*", { count: "exact", head: true }).eq("estado", "MORA"),
    supabase.from("prestamos").select("*", { count: "exact", head: true }).eq("estado", "SALDADO"),
    supabase.from("prestamos").select("*", { count: "exact", head: true }).eq("estado", "ACTIVO"),
    supabase
      .from("prestamos")
      .select("*", { count: "exact", head: true })
      .neq("estado", "SALDADO")
      .gte("fecha_proximo_vencimiento", todayStr)
      .lte("fecha_proximo_vencimiento", plus7Str),
    supabase.from("intereses_atrasados").select("prestamo_id").eq("estado", "PENDIENTE").gt("interes_pendiente", 0),
    supabase
      .from("reganches")
      .select("*", { count: "exact", head: true })
      .like("notas", "AUTO:%")
      .gte("created_at", desde7d),
  ])

  let totalPrestado = 0
  let capitalPendiente = 0
  for (const p of prestamos ?? []) {
    totalPrestado += Number(p.monto ?? 0)
    if (String(p.estado) !== "SALDADO") {
      capitalPendiente += Number(p.capital_pendiente ?? 0)
    }
  }

  let interesPendienteAcumulado = 0
  for (const i of interesesPend ?? []) {
    interesPendienteAcumulado += Number(i.interes_pendiente ?? i.monto ?? 0)
  }

  const sumReg = (rows: { monto_agregado: string | number }[] | null) =>
    (rows ?? []).reduce((a, r) => a + Number(r.monto_agregado ?? 0), 0)

  const prestamosConInteresPendiente = new Set((interesPrestamoRows ?? []).map((r) => r.prestamo_id)).size

  return NextResponse.json({
    totalPrestado: totalPrestado.toFixed(2),
    capitalPendiente: capitalPendiente.toFixed(2),
    interesPendienteAcumulado: interesPendienteAcumulado.toFixed(2),
    prestamosMora: moraCount ?? 0,
    prestamosSaldados: saldadosCount ?? 0,
    prestamosActivos: activosCount ?? 0,
    capitalizacionAuto: sumReg(autoRegs).toFixed(2),
    capitalizacionManual: sumReg(manRegs).toFixed(2),
    alertas: {
      vencenProximos7Dias: vencenProximos7 ?? 0,
      enMora: moraCount ?? 0,
      prestamosConInteresPendiente,
      capitalizacionesAutoUltimos7Dias: capAuto7d ?? 0,
    },
  })
}
