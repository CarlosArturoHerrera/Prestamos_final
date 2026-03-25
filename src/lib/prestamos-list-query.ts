import type { SupabaseClient } from "@supabase/supabase-js"
import {
  abonosCountFromRow,
  proyectarProximaCuota,
} from "@/lib/prestamo-logic"
import { resolveClienteIdsFromSearch } from "@/lib/prestamos-list-filters"

export const PRESTAMOS_LIST_SELECT = `
  *,
  clientes (
    id,
    nombre,
    apellido,
    cedula,
    representantes ( id, nombre, apellido ),
    empresas ( id, nombre )
  ),
  abonos(count)
`

export type PrestamosListPreFilters =
  | { empty: true }
  | { empty: false; prestamoIdsConInteres: number[] | null; clienteIdsBusqueda: number[] | null }

export async function resolvePrestamosListPreFilters(
  supabase: SupabaseClient,
  qText: string,
  conInteresPendiente: boolean,
): Promise<PrestamosListPreFilters> {
  let prestamoIdsConInteres: number[] | null = null
  if (conInteresPendiente) {
    const { data: pendRows } = await supabase
      .from("intereses_atrasados")
      .select("prestamo_id")
      .eq("estado", "PENDIENTE")
      .gt("interes_pendiente", 0)
    prestamoIdsConInteres = [...new Set((pendRows ?? []).map((r) => r.prestamo_id))]
    if (prestamoIdsConInteres.length === 0) {
      return { empty: true }
    }
  }

  let clienteIdsBusqueda: number[] | null = null
  const trimmed = qText.trim()
  if (trimmed) {
    clienteIdsBusqueda = await resolveClienteIdsFromSearch(supabase, trimmed)
    if (clienteIdsBusqueda.length === 0) {
      return { empty: true }
    }
  }

  return { empty: false, prestamoIdsConInteres, clienteIdsBusqueda }
}

type ApplyOpts = {
  clienteId: string | null
  estado: string | null
}

/** Query base del listado (orden fijo). count solo en rutas que paginan con total. */
export function createPrestamosListQuery(
  supabase: SupabaseClient,
  pre: Extract<PrestamosListPreFilters, { empty: false }>,
  opts: ApplyOpts,
  count?: "exact",
) {
  let q = supabase
    .from("prestamos")
    .select(PRESTAMOS_LIST_SELECT, count ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false })

  if (opts.clienteId) {
    q = q.eq("cliente_id", Number(opts.clienteId))
  }
  if (opts.estado) {
    q = q.eq("estado", opts.estado)
  }
  if (pre.prestamoIdsConInteres) {
    q = q.in("id", pre.prestamoIdsConInteres)
  }
  if (pre.clienteIdsBusqueda) {
    q = q.in("cliente_id", pre.clienteIdsBusqueda)
  }
  return q
}

export function mapPrestamoListRowFromRaw(raw: Record<string, unknown>) {
  const n = abonosCountFromRow(raw as { abonos?: { count?: number }[] | null })
  const { abonos: _a, ...prestamo } = raw as {
    abonos?: { count?: number }[] | null
    capital_pendiente: string | number
    tasa_interes: string | number
    plazo: number
    estado: string
    id: number
    [key: string]: unknown
  }
  const proj = proyectarProximaCuota(
    String(prestamo.capital_pendiente),
    String(prestamo.tasa_interes),
    Number(prestamo.plazo),
    n,
    String(prestamo.estado),
  )
  return {
    ...prestamo,
    abonos_realizados: n,
    interes_proximo: proj.interesProximo,
    capital_debitar_proximo: proj.capitalDebitarSugerido,
    total_proximo_pago: proj.totalProximoPago,
  }
}

export async function enrichPrestamoListRowsWithFlags<
  T extends { id: number },
>(supabase: SupabaseClient, rowsBase: T[]) {
  if (rowsBase.length === 0) return rowsBase

  const ids = rowsBase.map((r) => r.id)
  const [{ data: pendRows }, { data: regRows }] = await Promise.all([
    supabase
      .from("intereses_atrasados")
      .select("prestamo_id")
      .in("prestamo_id", ids)
      .eq("estado", "PENDIENTE")
      .gt("interes_pendiente", 0),
    supabase.from("reganches").select("prestamo_id, notas").in("prestamo_id", ids),
  ])

  const interesPendienteIds = new Set((pendRows ?? []).map((r) => r.prestamo_id))
  const capAuto = new Set<number>()
  const capManual = new Set<number>()
  for (const r of regRows ?? []) {
    const n = String(r.notas ?? "")
    const pid = r.prestamo_id as number
    if (n.startsWith("AUTO:")) capAuto.add(pid)
    if (n.startsWith("MANUAL:")) capManual.add(pid)
  }

  return rowsBase.map((r) => ({
    ...r,
    tiene_interes_pendiente: interesPendienteIds.has(r.id),
    tiene_capitalizacion_auto: capAuto.has(r.id),
    tiene_capitalizacion_manual: capManual.has(r.id),
  }))
}
