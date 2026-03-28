import { NextResponse } from "next/server";
import { getUserAndRole, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Pendientes según el último registro de gestión por cliente o por préstamo:
 * `proxima_fecha_contacto` definida y ≤ hoy (hora local como fecha ISO).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("gestion_cobranza")
    .select("id, cliente_id, prestamo_id, proxima_fecha_contacto, created_at")
    .order("created_at", { ascending: false })
    .limit(2500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const seen = new Set<string>();
  const pendientesBase: NonNullable<typeof rows> = [];

  for (const r of rows ?? []) {
    const key =
      r.prestamo_id != null ? `p:${r.prestamo_id}` : `c:${r.cliente_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prox = r.proxima_fecha_contacto as string | null | undefined;
    if (!prox || prox > today) continue;
    pendientesBase.push(r);
  }

  if (pendientesBase.length === 0) {
    return NextResponse.json({ total: 0, items: [] });
  }

  const selected = pendientesBase.slice(0, 20);
  const selectedIds = selected.map((r) => r.id);
  const { data: detailedRows, error: detailError } = await supabase
    .from("gestion_cobranza")
    .select(
      `
      id,
      cliente_id,
      prestamo_id,
      proxima_fecha_contacto,
      created_at,
      resultado,
      clientes ( id, nombre, apellido ),
      prestamos ( id, estado, capital_pendiente )
    `,
    )
    .in("id", selectedIds);

  if (detailError) {
    return NextResponse.json({ error: detailError.message }, { status: 400 });
  }

  const detailById = new Map((detailedRows ?? []).map((row) => [row.id, row]));
  const orderedItems = selected
    .map((row) => detailById.get(row.id))
    .filter(
      (row): row is NonNullable<typeof detailedRows>[number] => row != null,
    );

  return NextResponse.json({
    total: pendientesBase.length,
    items: orderedItems,
  });
}
