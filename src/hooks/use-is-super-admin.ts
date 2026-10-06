"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/fetch-api";
import { isAdminOnly, isSuperAdmin } from "@/lib/roles";

type ProfileResponse = { role?: string };

/**
 * Rol del usuario actual, leido de `/api/profile`, para decidir que acciones
 * mostrar. Es solo una ayuda de interfaz: la autorizacion real vive en la API
 * y en las policies de la base de datos.
 *
 * Empieza en `false` para que una accion reservada no llegue a parpadear en
 * pantalla mientras se resuelve la peticion.
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

/**
 * TRUE cuando el usuario es el ADMINISTRADOR TITULAR de su organizacion
 * (no un subusuario, y no el megaadministrador).
 *
 * Gobierna las acciones privilegiadas dentro de la cartera, como borrar un
 * prestamo. Ese privilegio estaba antes en manos del megaadministrador; con
 * el modelo corregido el megaadministrador ya no accede a la cartera, asi que
 * pasa al titular de la cuenta. La policy prestamos_delete_titular_only y el
 * guard soloTitular() imponen lo mismo en la base de datos y en la API.
 */
export function useIsAdminTitular(): boolean {
  const [titular, setTitular] = useState(false);

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const res = await fetchApi<ProfileResponse>("/api/profile");
      if (cancelado || !res.ok) return;
      setTitular(isAdminOnly(res.data.role));
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return titular;
}
