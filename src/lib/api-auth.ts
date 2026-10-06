import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { NextResponse as NR } from "next/server";
import { isPlatformPermission, type PermissionCode } from "@/lib/permissions";

// ── Role types ────────────────────────────────────────────────────────────────

/**
 * Jerarquía de la plataforma. Los dos primeros valores ya existían; `sub_user`
 * es el nuevo tercer nivel.
 *
 *   super_admin → MEGAADMINISTRADOR. Acceso global, sin organización propia.
 *   admin       → ADMINISTRADOR. Es un tenant: dueño de sus clientes,
 *                 préstamos, pagos y registros.
 *   sub_user    → SUBUSUARIO. Pertenece a un administrador y hereda su
 *                 organización con permisos granulares.
 */
export type AppRole = "super_admin" | "admin" | "sub_user";

/**
 * Sesión resuelta en el servidor. `adminId` es la clave de tenant y es lo único
 * en lo que deben basarse los filtros de datos: NUNCA un administrator_id
 * recibido del frontend (§17, §29).
 *
 *   super_admin → adminId = null  (acceso global, concedido explícitamente)
 *   admin       → adminId = su propio userId
 *   sub_user    → adminId = id de su administrador, o null si éste está
 *                 deshabilitado (§11: deshabilitar un administrador corta el
 *                 acceso de todos sus subusuarios).
 */
export type Session = {
  userId: string;
  role: AppRole;
  isActive: boolean;
  /** Tenant efectivo. null para el megaadministrador y para cuentas sin acceso. */
  adminId: string | null;
  /** Permisos efectivos. Administradores y megaadmin los tienen todos. */
  permissions: PermissionCode[];
  email: string | null;
  username: string | null;
  fullName: string | null;
};

export type EnsureProfileResult =
  | { ok: true; created: boolean }
  | { ok: false; message: string; code?: string };

type SessionContextRow = {
  userId: string;
  role: AppRole;
  isActive: boolean;
  adminId: string | null;
  email: string | null;
  username: string | null;
  fullName: string | null;
  parentActive: boolean;
  permissions: string[];
};

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Lee la sesión de Supabase y devuelve identidad, rol, tenant y permisos.
 *
 * Resuelve todo en UNA llamada a `public.session_context()` (función
 * SECURITY DEFINER): de lo contrario harían falta tres consultas —perfil,
 * administrador padre y permisos— en cada petición de la API.
 *
 * Devuelve null cuando no hay sesión autenticada.
 */
export async function getUserAndRole(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data, error: ctxError } = await supabase.rpc("session_context");

  if (!ctxError && data) {
    const ctx = data as SessionContextRow;
    return {
      userId: ctx.userId ?? user.id,
      role: ctx.role ?? "admin",
      // Un subusuario cuyo administrador está deshabilitado queda sin acceso.
      isActive: (ctx.isActive ?? true) && (ctx.parentActive ?? true),
      adminId: ctx.adminId ?? null,
      permissions: (ctx.permissions ?? []) as PermissionCode[],
      email: ctx.email ?? user.email ?? null,
      username: ctx.username ?? null,
      fullName: ctx.fullName ?? null,
    };
  }

  // Respaldo: la RPC no existe todavía (migración sin aplicar) o falló.
  // Se lee el perfil directamente para no dejar la app sin servicio.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, admin_id, email, username, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    const role = (profile.role as AppRole | undefined) ?? "admin";
    return {
      userId: user.id,
      role,
      isActive: profile.is_active ?? true,
      adminId: resolveTenantId(user.id, role, profile.admin_id ?? null),
      permissions: [],
      email: profile.email ?? user.email ?? null,
      username: profile.username ?? null,
      fullName: profile.full_name ?? null,
    };
  }

  // Último recurso: crear la fila de profiles si el trigger no lo hizo.
  const ensured = await ensureProfileRow(supabase, user.id, "admin");
  if (!ensured.ok) {
    console.error("[api-auth] No se pudo asegurar fila en profiles", {
      userId: user.id,
      reason: ensured.message,
      code: ensured.code ?? null,
    });
  }

  return {
    userId: user.id,
    role: "admin",
    isActive: true,
    adminId: user.id,
    permissions: [],
    email: user.email ?? null,
    username: null,
    fullName: null,
  };
}

/**
 * Deriva el tenant a partir del rol, con la misma regla que
 * `public.current_tenant_id()` en la base de datos.
 */
export function resolveTenantId(
  userId: string,
  role: AppRole,
  adminIdColumn: string | null,
): string | null {
  if (role === "admin") return userId;
  if (role === "sub_user") return adminIdColumn;
  return null; // super_admin: sin organización propia
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
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      message: `Error verificando profile: ${existingError.message}`,
      code: existingError.code,
    };
  }

  if (existing) return { ok: true, created: false };

  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, role });
  if (!error) return { ok: true, created: true };
  if (error.code === "23505") return { ok: true, created: false };

  return {
    ok: false,
    message: `Error creando profile: ${error.message}`,
    code: error.code,
  };
}

// ── Role checks ───────────────────────────────────────────────────────────────

/** Returns true when the role is super_admin (MEGAADMINISTRADOR). */
export function isSuperAdmin(role: AppRole): boolean {
  return role === "super_admin";
}

/** Returns true when the role owns an organization (ADMINISTRADOR). */
export function isAdminOnly(role: AppRole): boolean {
  return role === "admin";
}

/** Returns true when the role is a SUBUSUARIO. */
export function isSubUser(role: AppRole): boolean {
  return role === "sub_user";
}

/**
 * Returns true when the role may operate on portfolio data at all.
 *
 * Equivalente a `public.is_admin()` en la base de datos. El
 * MEGAADMINISTRADOR NO esta incluido: administra cuentas de la plataforma,
 * no clientes, prestamos, pagos ni registros. Esta exclusion es intencionada,
 * no un descuido.
 */
export function isAdmin(role: AppRole): boolean {
  return role === "admin" || role === "sub_user";
}

/**
 * Evalúa un permiso sobre una sesión ya resuelta.
 * Misma semántica que `public.has_permission()`: administradores y
 * megaadministrador lo tienen todo; el subusuario sólo lo concedido.
 */
export function hasPermission(
  session: Session | null,
  code: PermissionCode,
): boolean {
  if (!session || !session.isActive) return false;

  const esDePlataforma = isPlatformPermission(code);

  // Megaadministrador: SOLO permisos de plataforma. Nunca de negocio.
  if (session.role === "super_admin") return esDePlataforma;

  // Administradores y subusuarios: nunca permisos de plataforma.
  if (esDePlataforma) return false;

  // El administrador titular tiene todos los de negocio dentro de su ambito.
  if (session.role === "admin") return true;

  return session.permissions.includes(code);
}

// ── Guards para rutas API ─────────────────────────────────────────────────────

/**
 * Guard that asserts the session exists and the user is a super_admin.
 * Returns the stripped session or a NextResponse with the error.
 * Use in API routes: `const auth = requireSuperAdmin(session); if (auth instanceof NextResponse) return auth`
 */
export function requireSuperAdmin(
  session: Session | null,
): { userId: string; role: AppRole } | NextResponse {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  if (!isSuperAdmin(session.role)) return forbidden();
  return { userId: session.userId, role: session.role };
}

/**
 * Guard que exige una sesión activa CON organización (administrador o
 * subusuario). Devuelve el tenant ya resuelto, que es lo que deben usar las
 * rutas para filtrar datos.
 *
 * El megaadministrador NO pasa este guard: no tiene cartera propia. Si una
 * ruta debe servirle también, use `requireSession()` y trate `adminId === null`
 * como acceso global.
 */
export function requireTenant(
  session: Session | null,
): { userId: string; role: AppRole; adminId: string } | NextResponse {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  // El megaadministrador no tiene organizacion: 403 con motivo explicito.
  if (session.role === "super_admin") return forbiddenMegaadmin();
  if (!session.adminId) return forbidden();
  return {
    userId: session.userId,
    role: session.role,
    adminId: session.adminId,
  };
}

/**
 * Guard that asserts the session exists and the account is active.
 * Use in API routes: `const auth = guardAdmin(session); if (auth instanceof NextResponse) return auth`
 */
export function guardAdmin(
  session: Session | null,
): { userId: string; role: AppRole } | NextResponse {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  if (!isAdmin(session.role)) return forbidden();
  return { userId: session.userId, role: session.role };
}

/**
 * Guard de permiso granular (§14, §20). Devuelve 403 con un mensaje concreto
 * cuando el subusuario no tiene el permiso, en lugar de dejar que falle
 * silenciosamente contra RLS con un error de base de datos poco útil.
 *
 * Es defensa en profundidad: aunque esta comprobación se olvidara en una ruta,
 * las policies RESTRICTIVE de la base de datos siguen bloqueando la operación.
 */
export function requirePermission(
  session: Session | null,
  code: PermissionCode,
): Session | NextResponse {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  if (!hasPermission(session, code)) return forbiddenPermission(code);
  return session;
}

/**
 * Guard de TODA ruta de datos operativos: clientes, prestamos, abonos,
 * representantes, empresas, notificaciones, reportes y registros.
 *
 * Devuelve un NextResponse cuando hay que cortar, o null para continuar.
 *
 * El MEGAADMINISTRADOR recibe 403 aqui, a proposito: la plataforma se
 * administra desde /api/admin/*, no desde la cartera. Es la contrapartida en
 * la API de lo que las policies RLS ya imponen en la base de datos — alli no
 * le cuadra ninguna fila porque su `current_tenant_id()` es NULL. Esta
 * comprobacion solo convierte un "resultado vacio" confuso en un 403 claro.
 *
 * Uso:
 *   const bloqueo = soloOrganizacion(session);
 *   if (bloqueo) return bloqueo;
 */
export function soloOrganizacion(session: Session | null): NextResponse | null {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  if (session.role === "super_admin") return forbiddenMegaadmin();
  if (!session.adminId) return forbidden();
  return null;
}

/**
 * Guard que exige ser el ADMINISTRADOR TITULAR de la organizacion.
 * Excluye a los subusuarios y al megaadministrador. Para acciones reservadas
 * al dueno de la cuenta: gestionar subusuarios, borrar prestamos.
 */
export function soloTitular(session: Session | null): NextResponse | null {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  if (session.role === "super_admin") return forbiddenMegaadmin();
  if (session.role !== "admin" || !session.adminId) return forbidden();
  return null;
}

/**
 * Boolean helper — returns true when the role may operate on portfolio data.
 * Kept for backward compatibility with existing API routes.
 */
export function requireAdmin(role: AppRole): boolean {
  return isAdmin(role);
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

export function unauthorized(): NextResponse {
  return NR.json({ error: "No autorizado" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NR.json(
    { error: "No tienes permiso para esta acción" },
    { status: 403 },
  );
}

/**
 * 403 para el megaadministrador cuando intenta alcanzar datos operativos.
 * El mensaje explica que es una limitacion de diseno, no un fallo.
 */
export function forbiddenMegaadmin(): NextResponse {
  return NR.json(
    {
      error:
        "El megaadministrador no tiene acceso a los datos operativos de los administradores. Administra las cuentas desde el panel de Administradores.",
      motivo: "megaadmin_sin_acceso_a_datos",
    },
    { status: 403 },
  );
}

/** 403 indicando exactamente qué permiso falta (útil en la UI del subusuario). */
export function forbiddenPermission(code: PermissionCode): NextResponse {
  return NR.json(
    { error: "No tienes permiso para esta acción", permisoRequerido: code },
    { status: 403 },
  );
}

/** 404 para recursos de otra organización: no revela que el recurso existe. */
export function notFound(message = "Recurso no encontrado"): NextResponse {
  return NR.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NR.json({ error: message }, { status: 400 });
}

export function serverError(message: string): NextResponse {
  return NR.json({ error: message }, { status: 500 });
}
