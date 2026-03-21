import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", session.userId)
    .maybeSingle()

  return NextResponse.json({
    userId: session.userId,
    role: profile?.role ?? session.role,
    fullName: profile?.full_name ?? null,
  })
}
