import { createClient } from "@supabase/supabase-js"

/** Cliente anónimo (rutas/API legadas). En build sin .env usa placeholders. */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "placeholder-anon-key"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
