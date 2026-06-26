import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextResponse } from "next/server"
import { NextResponse as NR } from "next/server"

// ── Role types ────────────────────────────────────────────────────────────────

export type AppRole = "super_admin" | "admin"

export type EnsureProfileResult =
  | { ok: true; created: boolean }
  | { ok: false; message: string; code?: string }

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Reads the current Supabase session and returns the user's ID and role.
 * Falls back to creating a profile row with role "admin" if one doesn't exist.
 * Returns null when no authenticated session exists.
 */
export async function getUserAndRole(supabase: SupabaseClient): Promise<{
  userId: string
  role: AppRole
  isActive: boolean
} | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) {
    const role = (profile.role as AppRole | undefined) ?? "admin"
    const isActive = profile.is_active ?? true
    return { userId: user.id, role, isActive }
  }

  // Fallback: create profile row if missing (trigger should have created it)
  const ensured = await ensureProfileRow(supabase, user.id, "admin")
  if (!ensured.ok) {
    console.error("[api-auth] No se pudo asegurar fila en profiles", {
      userId: user.id,
      reason: ensured.message,
      code: ensured.code ?? null,
    })
  }

  return { userId: user.id, role: "admin", isActive: true }
}

/**
 * Ensures a profile row exists for the given user.
 * Uses an upsert to avoid race conditions.
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

// ── Role checks ───────────────────────────────────────────────────────────────

/** Returns true when the role is super_admin. */
export function isSuperAdmin(role: AppRole): boolean {
  return role === "super_admin"
}

/** Returns true when the role is admin or super_admin. */
export function isAdmin(role: AppRole): boolean {
  return role === "admin" || role === "super_admin"
}

/**
 * Guard that asserts the session exists and the user is a super_admin.
 * Returns the stripped session or a NextResponse with the error.
 * Use in API routes: `const auth = requireSuperAdmin(session); if (auth instanceof NextResponse) return auth`
 */
export function requireSuperAdmin(
  session: { userId: string; role: AppRole; isActive: boolean } | null,
): { userId: string; role: AppRole } | NextResponse {
  if (!session) return unauthorized()
  if (!session.isActive) return forbidden()
  if (!isSuperAdmin(session.role)) return forbidden()
  return { userId: session.userId, role: session.role }
}

/**
 * Guard that asserts the session exists and the user is an active admin.
 * Returns the stripped session or a NextResponse with the error.
 * Use in API routes: `const auth = guardAdmin(session); if (auth instanceof NextResponse) return auth`
 */
export function guardAdmin(
  session: { userId: string; role: AppRole; isActive: boolean } | null,
): { userId: string; role: AppRole } | NextResponse {
  if (!session) return unauthorized()
  if (!session.isActive) return forbidden()
  if (!isAdmin(session.role)) return forbidden()
  return { userId: session.userId, role: session.role }
}

/**
 * Boolean helper — returns true when the role is admin or super_admin.
 * Kept for backward compatibility with existing API routes.
 */
export function requireAdmin(role: AppRole): boolean {
  return isAdmin(role)
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

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
