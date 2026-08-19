"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/fetch-api";
import { isSuperAdmin } from "@/lib/roles";

type ProfileResponse = { role?: string };

/**
 * Rol del usuario actual, leído de `/api/profile`, para decidir qué acciones
 * mostrar. Es sólo una ayuda de interfaz: la autorización real vive en la API y
 * en las policies de la base de datos.
 *
 * Empieza en `false` para que una acción reservada no llegue a parpadear en
 * pantalla mientras se resuelve la petición.
 */
export function useIsSuperAdmin(): boolean {
  const [superAdmin, setSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const res = await fetchApi<ProfileResponse>("/api/profile");
      if (cancelado || !res.ok) return;
      setSuperAdmin(isSuperAdmin(res.data.role));
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return superAdmin;
}
