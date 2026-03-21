/**
 * Variables NEXT_PUBLIC_* inyectadas en build. Útil en componentes cliente.
 */
export function isSupabaseConfiguredOnClient(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.length) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length)
  )
}
