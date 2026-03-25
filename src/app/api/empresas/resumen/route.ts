import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const [{ count: total }, { count: conRnc }] = await Promise.all([
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase.from("empresas").select("*", { count: "exact", head: true }).not("rnc", "is", null),
  ])

  return NextResponse.json({
    total: total ?? 0,
    conRnc: conRnc ?? 0,
  })
}
