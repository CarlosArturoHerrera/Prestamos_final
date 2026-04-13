import { addDays, format, subDays } from "date-fns";
import { NextResponse } from "next/server";
import { getUserAndRole, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function intn(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

/** Métricas agregadas del portafolio y alertas operativas (sin filtros de listado). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const todayStr = format(hoy, "yyyy-MM-dd");
  const plus7Str = format(addDays(hoy, 7), "yyyy-MM-dd");
  const desde7d = subDays(new Date(), 7).toISOString();

  const { data, error } = await supabase.rpc(
    "api_prestamos_resumen_dashboard",
    {
      p_today: todayStr,
      p_plus7: plus7Str,
      p_desde_7d: desde7d,
    },
  );

  if (error) {
    console.error("[api/prestamos/resumen] RPC api_prestamos_resumen_dashboard falló, usando fallback", {
      message: error.message,
      code: error.code ?? null,
    });

    const [
      { data: prestamos, error: ePrestamos },
      { data: intereses, error: eIntereses },
      { data: reganches, error: eReganches },
    ] = await Promise.all([
      supabase
        .from("prestamos")
        .select("id, monto, capital_pendiente, estado, fecha_proximo_vencimiento"),
      supabase
        .from("intereses_atrasados")
        .select("prestamo_id, estado, interes_pendiente, monto"),
      supabase.from("reganches").select("monto_agregado, notas, created_at"),
    ]);

    if (ePrestamos || eIntereses || eReganches) {
      const message =
        ePrestamos?.message ?? eIntereses?.message ?? eReganches?.message ?? "No se pudo calcular el resumen";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const pRows = prestamos ?? [];
    const iRows = intereses ?? [];
    const rRows = reganches ?? [];

    const totalPrestado = pRows.reduce((acc, p) => acc + num(p.monto), 0);
    const capitalPendiente = pRows
      .filter((p) => String(p.estado ?? "").toUpperCase() !== "SALDADO")
      .reduce((acc, p) => acc + num(p.capital_pendiente), 0);

    const interesesPendientesRows = iRows.filter((i) => String(i.estado ?? "").toUpperCase() === "PENDIENTE");
    const interesPendienteAcumulado = interesesPendientesRows.reduce(
      (acc, i) => acc + num(i.interes_pendiente ?? i.monto),
      0,
    );

    const capitalizacionAuto = rRows
      .filter((r) => String(r.notas ?? "").startsWith("AUTO:"))
      .reduce((acc, r) => acc + num(r.monto_agregado), 0);
    const capitalizacionManual = rRows
      .filter((r) => String(r.notas ?? "").startsWith("MANUAL:"))
      .reduce((acc, r) => acc + num(r.monto_agregado), 0);

    const prestamosMora = pRows.filter((p) => String(p.estado ?? "").toUpperCase() === "MORA").length;
    const prestamosSaldados = pRows.filter((p) => String(p.estado ?? "").toUpperCase() === "SALDADO").length;
    const prestamosActivos = pRows.filter((p) => String(p.estado ?? "").toUpperCase() === "ACTIVO").length;

    const vencenProximos7Dias = pRows.filter((p) => {
      const estado = String(p.estado ?? "").toUpperCase();
      const f = String(p.fecha_proximo_vencimiento ?? "");
      return estado !== "SALDADO" && f >= todayStr && f <= plus7Str;
    }).length;

    const prestamosConInteresPendiente = new Set(
      interesesPendientesRows
        .filter((i) => num(i.interes_pendiente) > 0)
        .map((i) => Number(i.prestamo_id))
        .filter((id) => Number.isFinite(id)),
    ).size;

    const desde7dMs = new Date(desde7d).getTime();
    const capitalizacionesAutoUltimos7Dias = rRows.filter((r) => {
      if (!String(r.notas ?? "").startsWith("AUTO:")) return false;
      const ts = new Date(String(r.created_at ?? "")).getTime();
      return Number.isFinite(ts) && ts >= desde7dMs;
    }).length;

    return NextResponse.json({
      totalPrestado: totalPrestado.toFixed(2),
      capitalPendiente: capitalPendiente.toFixed(2),
      interesPendienteAcumulado: interesPendienteAcumulado.toFixed(2),
      prestamosMora,
      prestamosSaldados,
      prestamosActivos,
      capitalizacionAuto: capitalizacionAuto.toFixed(2),
      capitalizacionManual: capitalizacionManual.toFixed(2),
      alertas: {
        vencenProximos7Dias,
        enMora: prestamosMora,
        prestamosConInteresPendiente,
        capitalizacionesAutoUltimos7Dias,
      },
    });
  }

  const r = data as Record<string, unknown> | null;
  if (!r) {
    return NextResponse.json(
      { message: "Sin datos de resumen" },
      { status: 400 },
    );
  }

  const mora = intn(r.prestamosMora);

  return NextResponse.json({
    totalPrestado: num(r.totalPrestado).toFixed(2),
    capitalPendiente: num(r.capitalPendiente).toFixed(2),
    interesPendienteAcumulado: num(r.interesPendienteAcumulado).toFixed(2),
    prestamosMora: mora,
    prestamosSaldados: intn(r.prestamosSaldados),
    prestamosActivos: intn(r.prestamosActivos),
    capitalizacionAuto: num(r.capitalizacionAuto).toFixed(2),
    capitalizacionManual: num(r.capitalizacionManual).toFixed(2),
    alertas: {
      vencenProximos7Dias: intn(r.vencenProximos7Dias),
      enMora: mora,
      prestamosConInteresPendiente: intn(r.prestamosConInteresPendiente),
      capitalizacionesAutoUltimos7Dias: intn(
        r.capitalizacionesAutoUltimos7Dias,
      ),
    },
  });
}
