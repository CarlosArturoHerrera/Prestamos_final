import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextResponse } from "next/server"
import { NextResponse as NR } from "next/server"

export type AppRole = "ADMIN" | "OPERADOR"
export type EnsureProfileResult =
  | { ok: true; created: boolean }
  | { ok: false; message: string; code?: string }

export async function getUserAndRole(supabase: SupabaseClient): Promise<{
  userId: string
  role: AppRole
} | null> {
  const {h
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) {
    const role = (profile.role as AppRole | undefined) ?? "OPERADOR"
    return { userId: user.id, role }
  }

  // Fix permanente: si por cualquier razón no existe profile, intentamos crearlo automáticamente.
  const ensured = await ensureProfileRow(supabase, user.id, "OPERADOR")
  if (!ensured.ok) {
    console.error("[api-auth] No se pudo asegurar fila en profiles", {
      userId: user.id,
      reason: ensured.message,
      code: ensured.code ?? null,
    })
  }

  return { userId: user.id, role: "OPERADOR" }
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

/**
 * Asegura que exista `public.profiles` para el usuario de auth (`id` = `auth.users.id`).
 * Sin fila en `profiles`, FKs como `gestion_cobranza.creado_por` fallan aunque la sesión sea válida.
 */
export async function ensureProfileRow(
  supabase: SupabaseClient,
  userId: string,
  role: AppRole,
): Promise<EnsureProfileResult> {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (existingError) {
    return {
      ok: false,
      message: `Error verificando profile: ${existingError.message}`,
      code: existingError.code,
    }
  }

  if (existing) return { ok: true, created: false }

  const { error } = await supabase.from("profiles").insert({ id: userId, role })
  if (!error) return { ok: true, created: true }
  if (error.code === "23505") return { ok: true, created: false }

  return {
    ok: false,
    message: `Error creando profile: ${error.message}`,
    code: error.code,
  }
}
