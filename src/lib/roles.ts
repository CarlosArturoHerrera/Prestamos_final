import type { AppRole } from "@/lib/api-auth"

// ── Client-side role helpers ──────────────────────────────────────────────────
// These functions work with the role string fetched from /api/profile.
// They are safe to import in "use client" components.

export function isSuperAdmin(role: AppRole | string | null | undefined): boolean {
  return role === "super_admin"
}

export function isAdmin(role: AppRole | string | null | undefined): boolean {
  return role === "admin" || role === "super_admin"
}

export function getRoleLabel(role: AppRole | string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super Admin"
    case "admin":
      return "Administrador"
    default:
      return "Sin rol"
  }
}

export function getRoleBadgeVariant(
  role: AppRole | string | null | undefined,
): "default" | "secondary" | "outline" {
  switch (role) {
    case "super_admin":
      return "default"
    case "admin":
      return "secondary"
    default:
      return "outline"
  }
}
