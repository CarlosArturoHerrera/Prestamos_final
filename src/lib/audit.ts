/**
 * audit.ts — Registro de acciones administrativas (§28).
 *
 * Qué se registra: quién hizo qué, sobre qué entidad y en qué organización.
 * Qué NUNCA se registra: contraseñas, tokens, enlaces de recuperación, claves
 * ni ninguna credencial. `sanitizeDetail()` elimina esas claves del payload
 * aunque quien llame se despiste, porque un log es exactamente el sitio donde
 * un secreto filtrado sobrevive más tiempo.
 *
 * La escritura va siempre por service_role: `audit_logs` es append-only (un
 * trigger rechaza UPDATE y DELETE) y sólo el megaadministrador puede leerla.
 */

import type { AppRole, Session } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  // Megaadministrador → administradores
  | "admin.crear"
  | "admin.editar"
  | "admin.deshabilitar"
  | "admin.reactivar"
  | "admin.eliminar"
  | "admin.reset_password"
  | "admin.mantenimiento_configurar"
  | "admin.mantenimiento_pago"
  | "admin.mensaje_enviar"
  | "admin.mensaje_editar"
  | "admin.mensaje_eliminar"
  // Administrador → subusuarios
  | "subusuario.crear"
  | "subusuario.editar"
  | "subusuario.deshabilitar"
  | "subusuario.reactivar"
  | "subusuario.eliminar"
  | "subusuario.permisos"
  | "subusuario.reset_password";

export type AuditEntry = {
  action: AuditAction;
  /** Tipo de entidad afectada: 'profile', 'admin_maintenance', 'admin_message'… */
  entity?: string;
  entityId?: string | null;
  /** Organización afectada. Para acciones sobre un administrador, su propio id. */
  adminId?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
};

/** Claves que jamás deben acabar en el rastro de auditoría. */
const SENSITIVE_KEYS = [
  "password",
  "contrasena",
  "contraseña",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "actionlink",
  "action_link",
  "secret",
  "apikey",
  "api_key",
  "servicerolekey",
  "authorization",
  "cookie",
];

/**
 * Copia el payload eliminando recursivamente cualquier clave sensible.
 * Compara en minúsculas y sin guiones bajos para que `Password`, `API_KEY` o
 * `accessToken` caigan igual.
 */
export function sanitizeDetail(input: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundidad máxima]";
  if (input === null || input === undefined) return input;
  if (Array.isArray(input))
    return input.map((v) => sanitizeDetail(v, depth + 1));
  if (typeof input !== "object") return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "");
    if (SENSITIVE_KEYS.some((s) => normalized.includes(s.replace(/_/g, "")))) {
      continue; // se omite por completo: ni siquiera "[REDACTED]"
    }
    out[key] = sanitizeDetail(value, depth + 1);
  }
  return out;
}

/**
 * Escribe una entrada de auditoría. No lanza nunca: una acción administrativa
 * correcta no debe fallar porque el log no se pudo escribir — se reporta por
 * consola y la petición continúa.
 */
export async function auditLog(
  actor: Pick<Session, "userId" | "role" | "email"> | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from("audit_logs").insert({
      actor_id: actor?.userId ?? null,
      actor_role: (actor?.role as AppRole | undefined) ?? null,
      actor_email: actor?.email ?? null,
      accion: entry.action,
      entidad: entry.entity ?? null,
      entidad_id: entry.entityId ?? null,
      admin_id: entry.adminId ?? null,
      detalle: sanitizeDetail(entry.detail ?? {}) as Record<string, unknown>,
      ip: entry.ip ?? null,
    });
    if (error) {
      console.error("[audit] no se pudo registrar la acción", {
        action: entry.action,
        reason: error.message,
      });
    }
  } catch (err) {
    console.error("[audit] error inesperado", {
      action: entry.action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Extrae la IP del cliente de las cabeceras habituales detrás de proxy. */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
