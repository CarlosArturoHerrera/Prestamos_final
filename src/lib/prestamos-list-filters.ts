import type { SupabaseClient } from "@supabase/supabase-js"

/** Normaliza el término para ilike (evita comodines accidentales). */
function ilikeTerm(raw: string): string {
  return raw.trim().replace(/[%_]/g, "")
}

/**
 * IDs de clientes cuyo nombre, apellido, cédula, empresa o representante coinciden con el texto.
 */
export async function resolveClienteIdsFromSearch(
  supabase: SupabaseClient,
  raw: string,
): Promise<number[]> {
  const term = ilikeTerm(raw)
  if (!term) return []

  const s = `%${term}%`
  const ids = new Set<number>()

  const { data: direct } = await supabase
    .from("clientes")
    .select("id")
    .or(`nombre.ilike.${s},apellido.ilike.${s},cedula.ilike.${s}`)
  for (const r of direct ?? []) ids.add(r.id)

  const { data: empRows } = await supabase.from("empresas").select("id").ilike("nombre", s)
  const empIds = (empRows ?? []).map((e) => e.id).filter(Boolean)
  if (empIds.length > 0) {
    const { data: porEmpresa } = await supabase.from("clientes").select("id").in("empresa_id", empIds)
    for (const r of porEmpresa ?? []) ids.add(r.id)
  }

  const { data: repRows } = await supabase
    .from("representantes")
    .select("id")
    .or(`nombre.ilike.${s},apellido.ilike.${s}`)
  const repIds = (repRows ?? []).map((e) => e.id).filter(Boolean)
  if (repIds.length > 0) {
    const { data: porRep } = await supabase.from("clientes").select("id").in("representante_id", repIds)
    for (const r of porRep ?? []) ids.add(r.id)
  }

  return [...ids]
}
