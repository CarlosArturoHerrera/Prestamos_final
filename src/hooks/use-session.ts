"use client";

import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/api-auth";
import { fetchApi } from "@/lib/fetch-api";
import type { PermissionCode } from "@/lib/permissions";

/**
 * Sesión del usuario actual leída de `/api/profile`.
 *
 * Es sólo una ayuda de interfaz: sirve para no mostrar acciones que el backend
 * rechazaría. La autorización real vive en las rutas API y en las policies RLS.
 * Ocultar un botón no protege nada.
 */

export type SessionInfo = {
  userId: string;
  role: AppRole;
  isActive: boolean;
  adminId: string | null;
  permissions: PermissionCode[];
  email: string | null;
  username: string | null;
  fullName: string | null;
};

export type UseSessionResult = {
  session: SessionInfo | null;
  cargando: boolean;
  /** Comprueba un permiso con la misma semántica que el servidor. */
  puede: (code: PermissionCode) => boolean;
  esMegaadmin: boolean;
  esAdministrador: boolean;
  esSubusuario: boolean;
};

export function useSession(): UseSessionResult {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const res = await fetchApi<SessionInfo>("/api/profile");
      if (cancelado) return;
      if (res.ok) setSession(res.data);
      setCargando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const role = session?.role;

  // Mientras carga se devuelve `false` en todo, para que una acción reservada
  // no llegue a parpadear en pantalla antes de resolverse la petición.
  const puede = (code: PermissionCode): boolean => {
    if (!session || !session.isActive) return false;
    if (session.role === "super_admin" || session.role === "admin") return true;
    return session.permissions.includes(code);
  };

  return {
    session,
    cargando,
    puede,
    esMegaadmin: role === "super_admin",
    esAdministrador: role === "admin",
    esSubusuario: role === "sub_user",
  };
}
