import { startOfMonth } from "date-fns";
import { NextResponse } from "next/server";
import { getUserAndRole, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const inicioMes = startOfMonth(new Date()).toISOString().slice(0, 10);

  const [
    { data: activos },
    { count: prestamosMora },
    { data: recaudacionAgg },
    { data: proximos },
    { data: abonosRecientes },
  ] = await Promise.all([
    supabase.from("prestamos").select("cliente_id").eq("estado", "ACTIVO"),
    supabase
      .from("prestamos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "MORA"),
    supabase
      .from("abonos")
      .select("total_pagado.sum()")
      .gte("fecha_abono", inicioMes),
    supabase
      .from("prestamos")
      .select(
        `
        id,
        fecha_proximo_vencimiento,
        capital_pendiente,
        estado,
        clientes ( nombre, apellido )
      `,
      )
      .in("estado", ["ACTIVO", "MORA"])
      .order("fecha_proximo_vencimiento", { ascending: true })
      .limit(8),
    supabase
      .from("abonos")
      .select(
        `
        id,
        fecha_abono,
        total_pagado,
        prestamo_id,
        prestamos (
          id,
          clientes ( nombre, apellido )
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const clientesActivos = new Set((activos ?? []).map((r) => r.cliente_id))
    .size;

  /** PostgREST: `total_pagado.sum()` suele exponerse como `total_pagado_sum` o `sum`. */
  const recaudacionRow = recaudacionAgg?.[0] as
    | Record<string, string | number | null | undefined>
    | undefined;
  const recaudacionRaw =
    recaudacionRow?.total_pagado_sum ?? recaudacionRow?.sum ?? null;
  const recaudacionParsed =
    recaudacionRaw === null || recaudacionRaw === undefined
      ? 0
      : Number(recaudacionRaw);
  const recaudacionMes = Number.isFinite(recaudacionParsed)
    ? recaudacionParsed
    : 0;

  return NextResponse.json({
    clientes_activos: clientesActivos,
    prestamos_en_mora: prestamosMora ?? 0,
    recaudacion_mes: recaudacionMes.toFixed(2),
    proximos_vencimientos: proximos ?? [],
    abonos_recientes: abonosRecientes ?? [],
  });
}
