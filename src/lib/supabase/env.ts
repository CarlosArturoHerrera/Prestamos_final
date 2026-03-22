/**
 * URL y anon key de Supabase para **servidor, RSC y middleware (Edge)**.
 *
 * Orden: `NEXT_PUBLIC_*` primero (recomendado en Vercel para que el cliente y el
 * servidor compartan la misma config), si no existen se usa `SUPABASE_URL` /
 * `SUPABASE_ANON_KEY` (solo servidor; en el **navegador** no existen).
 */
export function getSupabaseUrlAndAnonKeyForServer():
  | { url: string; key: string }
  | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim()
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return null
  return { url, key }
}
