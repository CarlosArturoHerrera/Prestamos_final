"use client";

import { createContext, useContext, useMemo } from "react";
import type { AppRole } from "@/lib/api-auth";
import { isPlatformPermission, type PermissionCode } from "@/lib/permissions";

/**
 * Permisos de la sesión, repartidos por contexto desde el layout.
 *
 * Los resuelve el SERVIDOR y bajan ya calculados, así que no hay petición al
 * montar ni parpadeo: un botón que el usuario no puede usar nunca llega a
 * pintarse. Si se leyeran con un `fetch` desde el cliente habría un instante
 * en que todo se ve, que es justo lo que queremos evitar.
 *
 * Esto es PRESENTACIÓN. La autorización real la imponen las rutas API y las
 * policies RLS: ocultar un botón no protege nada, sólo evita ofrecer una
 * acción que terminaría en un 403.
 */

type Contexto = {
  role: AppRole;
  permissions: PermissionCode[];
};

const PermisosContext = createContext<Contexto | null>(null);

export function PermisosProvider({
  role,
  permissions,
  children,
}: Contexto & { children: React.ReactNode }) {
  const valor = useMemo(() => ({ role, permissions }), [role, permissions]);
  return (
    <PermisosContext.Provider value={valor}>
      {children}
    </PermisosContext.Provider>
  );
}

/**
 * Comprueba un permiso con la misma semántica que `has_permission()` en la
 * base de datos y `hasPermission()` en la API:
 *
 *   megaadministrador → sólo permisos de plataforma (`administradores.*`)
 *   administrador     → todos los de negocio dentro de su organización
 *   subusuario        → sólo los concedidos explícitamente
 *
 * Fuera del provider devuelve `false` siempre: sin información, no se ofrece
 * la acción.
 */
export function usePuede(): (code: PermissionCode) => boolean {
  const ctx = useContext(PermisosContext);

  return useMemo(() => {
    if (!ctx) return () => false;
    const { role, permissions } = ctx;

    return (code: PermissionCode) => {
      const dePlataforma = isPlatformPermission(code);
      if (role === "super_admin") return dePlataforma;
      if (dePlataforma) return false;
      if (role === "admin") return true;
      return permissions.includes(code);
    };
  }, [ctx]);
}

/** Rol de la sesión, para los casos en que importa el rol y no un permiso. */
export function useRolSesion(): AppRole | null {
  return useContext(PermisosContext)?.role ?? null;
}

/**
 * Renderiza a sus hijos sólo si la sesión tiene el permiso.
 *
 *   <SiPuede permiso="clientes.crear">
 *     <Button>Nuevo cliente</Button>
 *   </SiPuede>
 *
 * `fallback` permite poner algo en su lugar (un texto, un botón deshabilitado);
 * por defecto no se pinta nada.
 */
export function SiPuede({
  permiso,
  children,
  fallback = null,
}: {
  permiso: PermissionCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const puede = usePuede();
  return <>{puede(permiso) ? children : fallback}</>;
}
