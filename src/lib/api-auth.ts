import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextResponse } from "next/server"
import { NextResponse as NR } from "next/server"

export type AppRole = "ADMIN" | "OPERADOR"

export async function getUserAndRole(supabase: SupabaseClient): Promise<{
  userId: string
  role: AppRole
} | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = (profile?.role as AppRole | undefined) ?? "OPERADOR"
  return { userId: user.id, role }
}

export function unauthorized(): NextResponse {
  return NR.json({ error: "No autorizado" }, { status: 401 })
}

export function forbidden(): NextResponse {
  return NR.json({ error: "No tienes permiso para esta acción" }, { status: 403 })
}

export function badRequest(message: string): NextResponse {
  return NR.json({ error: message }, { status: 400 })
}

export function serverError(message: string): NextResponse {
  return NR.json({ error: message }, { status: 500 })
}

export function requireAdmin(role: AppRole): boolean {
  return role === "ADMIN"
}
