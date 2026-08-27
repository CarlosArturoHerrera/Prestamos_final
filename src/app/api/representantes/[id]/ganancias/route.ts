import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth";
import {
  COMISION_POR_TASA,
  construirGananciasRepresentante,
  type GananciaAbonoRow,
  type GananciaClienteRow,
  type GananciaInteresRow,
  type GananciaPrestamoRow,
} from "@/lib/ganancias-representante";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gananciasRepresentanteQuerySchema } from "@/lib/validations/schemas";

type Ctx = { params: Promise<{ id: string }> };

const CHUNK = 1000;

/** Lee una tabla completa en páginas de 1000 filas (límite por defecto de PostgREST). */
async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build(from, from + CHUNK - 1);
    if (error) return { rows, error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < CHUNK) return { rows, error: null };
  }
}

/**
 * Ganancias del representante: comisión sobre el interés que sus clientes
 * asignados pagaron realmente. Solo lectura — no toca préstamos, abonos ni
 * intereses. Misma autenticación que el resto del módulo (`getUserAndRole` +
 * RLS de `is_admin()` sobre las tablas consultadas).
 */
export async function GET(request: Request, ctx: Ctx) {
  const supabase: SupabaseClient = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return badRequest("ID inválido");

  const { searchParams } = new URL(request.url);
  const parsed = gananciasRepresentanteQuerySchema.safeParse({
    desde: searchParams.get("desde") || undefined,
    hasta: searchParams.get("hasta") || undefined,
  });
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    );
  }
  const { desde, hasta } = parsed.data;
  if (desde && hasta && desde > hasta) {
    return badRequest("El rango de fechas es inválido");
  }

  const { data: representante, error: re } = await supabase
    .from("representantes")
    .select("id, nombre, apellido, email, telefono")
    .eq("id", id)
    .maybeSingle();

  if (re) {
    return NextResponse.json({ error: re.message }, { status: 400 });
  }
  if (!representante) {
    return NextResponse.json(
      { error: "Representante no encontrado" },
      { status: 404 },
    );
  }

  const base = {
    representante: {
      id: representante.id as number,
      nombre: String(representante.nombre ?? ""),
      apellido: String(representante.apellido ?? ""),
      nombreCompleto:
        `${representante.nombre ?? ""} ${representante.apellido ?? ""}`.trim(),
    },
    periodo: { desde: desde ?? null, hasta: hasta ?? null },
    comisiones: COMISION_POR_TASA,
  };

  const vacio = {
    ...base,
    clientesAsignados: 0,
    prestamosRevisados: 0,
    totales: {
      interesPagado: "0.00",
      ganancia: "0.00",
      clientesConGanancia: 0,
      prestamosConGanancia: 0,
    },
    porTasa: COMISION_POR_TASA.map((c) => ({
      tasa: c.tasa,
      comisionTasa: c.comision,
      comisionable: true,
      prestamos: 0,
      clientes: 0,
      interesPagado: "0.00",
      ganancia: "0.00",
    })),
    detalle: [],
  };

  // ── Representante → clientes asignados ──────────────────────────────────────
  const { data: clientesData, error: ce } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, cedula")
    .eq("representante_id", id);

  if (ce) {
    return NextResponse.json({ error: ce.message }, { status: 400 });
  }

  const clientes = (clientesData ?? []) as GananciaClienteRow[];
  if (clientes.length === 0) {
    return NextResponse.json(vacio);
  }

  // ── Clientes → préstamos ────────────────────────────────────────────────────
  const clienteIds = clientes.map((c) => c.id);
  const { data: prestamosData, error: pe } = await supabase
    .from("prestamos")
    .select("id, cliente_id, tasa_interes, estado")
    .in("cliente_id", clienteIds);

  if (pe) {
    return NextResponse.json({ error: pe.message }, { status: 400 });
  }

  const prestamos = (prestamosData ?? []) as GananciaPrestamoRow[];
  if (prestamos.length === 0) {
    return NextResponse.json({ ...vacio, clientesAsignados: clientes.length });
  }

  // ── Préstamos → interés realmente cobrado ───────────────────────────────────
  const prestamoIds = prestamos.map((p) => p.id);

  const [abonosRes, interesesRes] = await Promise.all([
    fetchAll<GananciaAbonoRow>((from, to) =>
      supabase
        .from("abonos")
        .select("id, prestamo_id, fecha_abono, interes_cobrado")
        .in("prestamo_id", prestamoIds)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<GananciaInteresRow>((from, to) =>
      supabase
        .from("intereses_atrasados")
        .select(
          "id, prestamo_id, estado, fecha_aplicado, fecha_periodo, fecha_generado, interes_generado, interes_pagado, monto",
        )
        .in("prestamo_id", prestamoIds)
        .eq("estado", "PAGADO")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (abonosRes.error) {
    return NextResponse.json({ error: abonosRes.error }, { status: 400 });
  }
  if (interesesRes.error) {
    return NextResponse.json({ error: interesesRes.error }, { status: 400 });
  }

  const resultado = construirGananciasRepresentante({
    clientes,
    prestamos,
    abonos: abonosRes.rows,
    interesesPeriodo: interesesRes.rows,
    desde,
    hasta,
  });

  return NextResponse.json({
    ...base,
    clientesAsignados: clientes.length,
    prestamosRevisados: prestamos.length,
    ...resultado,
  });
}
