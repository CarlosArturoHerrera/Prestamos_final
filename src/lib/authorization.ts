/**
 * authorization.ts — Módulo centralizado de autorización.
 *
 * Modelo de permisos:
 *   super_admin → puede realizar cualquier acción sobre cualquier usuario,
 *                 incluyendo su propia cuenta.
 *   admin       → no puede modificar ninguna cuenta, ni la suya propia.
 *
 * La seguridad está garantizada en tres capas:
 *   1. Políticas RLS sobre la tabla profiles (capa de base de datos)
 *   2. Guards en las rutas de API (requireSuperAdmin / guardAdmin)
 *   3. Este módulo (capa de UI — conveniencia, NO fuente de verdad)
 *
 * Los helpers de UI evitan mostrar acciones que el backend rechazaría,
 * pero la autorización real siempre la valida el servidor.
 */

import type { AppRole } from "@/lib/api-auth"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthActor = {
  userId: string
  role: AppRole
}

export type AuthTarget = {
  id: string
  role: AppRole
}

// ── Core permission predicates ────────────────────────────────────────────────

/**
 * super_admin puede editar cualquier usuario, incluyendo sí mismo.
 * admin no puede editar ningún usuario, ni siquiera su propia cuenta.
 */
export function canEditUser(_actor: AuthActor, _target: AuthTarget): boolean {
  return _actor.role === "super_admin"
}

/**
 * super_admin puede editar su propio perfil.
 * admin no puede editar su propio perfil.
 */
export function canEditSelf(actor: AuthActor): boolean {
  return actor.role === "super_admin"
}

/**
 * super_admin puede cambiar su propia contraseña.
 * admin no puede cambiar su contraseña.
 */
export function canChangePassword(actor: AuthActor): boolean {
  return actor.role === "super_admin"
}

/**
 * super_admin puede cambiar su propio email.
 * admin no puede cambiar su email.
 */
export function canChangeEmail(actor: AuthActor): boolean {
  return actor.role === "super_admin"
}

/**
 * Solo super_admin puede crear, eliminar, activar o desactivar usuarios.
 */
export function canManageUsers(actor: AuthActor): boolean {
  return actor.role === "super_admin"
}

/**
 * Determina si el actor puede desactivar/reactivar al usuario objetivo.
 * Reglas:
 *   - Solo super_admin puede hacer toggle de cuentas.
 *   - No se puede desactivar una cuenta super_admin (ni la propia).
 *   - No se puede desactivar la propia cuenta.
 */
export function canToggleUser(actor: AuthActor, target: AuthTarget): boolean {
  if (actor.role !== "super_admin") return false
  if (target.role === "super_admin") return false   // protege cuentas super_admin
  if (actor.userId === target.id) return false       // protege cuenta propia
  return true
}

/**
 * Determina si el actor puede eliminar al usuario objetivo.
 * Reglas:
 *   - Solo super_admin puede eliminar cuentas.
 *   - No se puede eliminar una cuenta super_admin.
 *   - No se puede eliminar la propia cuenta.
 */
export function canDeleteUser(actor: AuthActor, target: AuthTarget): boolean {
  if (actor.role !== "super_admin") return false
  if (target.role === "super_admin") return false   // protege cuentas super_admin
  if (actor.userId === target.id) return false       // protege cuenta propia
  return true
}

/**
 * Determina si el menú de acciones de fila debe mostrarse para el objetivo.
 * Muestra el menú cuando:
 *   - El actor es super_admin Y el objetivo es un admin (gestión normal).
 *   - El actor es super_admin Y el objetivo es su propia cuenta (self-edit).
 * Oculta el menú cuando:
 *   - El objetivo es otro super_admin diferente al actor.
 *   - El actor no es super_admin.
 */
export function canShowRowActions(actor: AuthActor, target: AuthTarget): boolean {
  if (actor.role !== "super_admin") return false
  if (target.role === "admin") return true            // gestión de administradores
  if (actor.userId === target.id) return true         // self-edit del super_admin
  return false                                         // otros super_admin: protegidos
}
