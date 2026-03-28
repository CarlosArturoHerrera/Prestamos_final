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
    return NextResponse.json({ message: error.message }, { status: 400 });
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
