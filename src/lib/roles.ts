import type { AppRole } from "@/lib/api-auth";

// ── Client-side role helpers ──────────────────────────────────────────────────
// These functions work with the role string fetched from /api/profile.
// They are safe to import in "use client" components.
//
// Conveniencia de UI únicamente. La autorización real la deciden siempre las
// policies RLS y los guards de las rutas API.

export function isSuperAdmin(
  role: AppRole | string | null | undefined,
): boolean {
  return role === "super_admin";
}

/** Administrador propietario de una organización (no el megaadministrador). */
export function isAdminOnly(
  role: AppRole | string | null | undefined,
): boolean {
  return role === "admin";
}

/** Subusuario: trabaja dentro de la organización de un administrador. */
export function isSubUser(role: AppRole | string | null | undefined): boolean {
  return role === "sub_user";
}

/** Cualquier rol con acceso a datos de cartera. */
export function isAdmin(role: AppRole | string | null | undefined): boolean {
  return role === "admin" || role === "super_admin" || role === "sub_user";
}

/** Puede gestionar subusuarios: administradores y megaadministrador. */
export function canManageSubUsers(
  role: AppRole | string | null | undefined,
): boolean {
  return role === "admin" || role === "super_admin";
}

export function getRoleLabel(
  role: AppRole | string | null | undefined,
): string {
  switch (role) {
    case "super_admin":
      return "Megaadministrador";
    case "admin":
      return "Administrador";
    case "sub_user":
      return "Subusuario";
    default:
      return "Sin rol";
  }
}

export function getRoleBadgeVariant(
  role: AppRole | string | null | undefined,
): "default" | "secondary" | "outline" {
  switch (role) {
    case "super_admin":
      return "default";
    case "admin":
      return "secondary";
    case "sub_user":
      return "outline";
    default:
      return "outline";
  }
}
