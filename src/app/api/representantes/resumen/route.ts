import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const [{ count: totalRepresentantes }, { count: totalClientesVinculados }] = await Promise.all([
    supabase.from("representantes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
  ])

  return NextResponse.json({
    totalRepresentantes: totalRepresentantes ?? 0,
    totalClientesVinculados: totalClientesVinculados ?? 0,
  })
}
