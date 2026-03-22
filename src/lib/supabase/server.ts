import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseUrlAndAnonKeyForServer } from "@/lib/supabase/env"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  const env = getSupabaseUrlAndAnonKeyForServer()
  if (!env) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_URL / SUPABASE_ANON_KEY",
    )
  }
  const { url, key } = env

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component: cookies pueden ser de solo lectura
        }
      },
    },
  })
}
