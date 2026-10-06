-- =============================================================================
-- Refresco masivo del estado de mantenimiento.
--
-- Por qué hace falta
-- ------------------
-- `refrescar_estado_mantenimiento(admin_id)` actualiza un administrador, y se
-- llamaba solo al abrir su ficha o al iniciar sesion ese administrador. La
-- LISTA de administradores mostraba el estado ALMACENADO, que podia estar
-- obsoleto: un vencimiento que paso ayer seguia apareciendo como "Pendiente"
-- hasta que alguien abriera esa ficha concreta.
--
-- Como el estado es justo lo que responde "¿han pagado o no?", tiene que estar
-- al dia en la lista. Esta funcion recalcula todos de una vez; la llama el
-- panel de administradores al cargar.
--
-- EXENTO no se toca nunca: es una decision manual del megaadministrador.
-- No modifica importes ni fechas, solo el estado derivado de ellos.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.refrescar_estados_mantenimiento()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n int := 0;
BEGIN
  UPDATE public.admin_maintenance m
     SET estado = CASE
                    WHEN m.proximo_pago IS NULL
                      THEN 'PENDIENTE'::public.estado_mantenimiento
                    WHEN m.proximo_pago < current_date
                      THEN 'VENCIDO'::public.estado_mantenimiento
                    WHEN m.ultimo_pago IS NOT NULL
                      THEN 'AL_DIA'::public.estado_mantenimiento
                    ELSE 'PENDIENTE'::public.estado_mantenimiento
                  END,
         updated_at = now()
   WHERE m.estado <> 'EXENTO'
     -- Solo escribe cuando el estado cambia de verdad, para no tocar
     -- updated_at de todas las filas en cada carga de la pantalla.
     AND m.estado IS DISTINCT FROM CASE
           WHEN m.proximo_pago IS NULL
             THEN 'PENDIENTE'::public.estado_mantenimiento
           WHEN m.proximo_pago < current_date
             THEN 'VENCIDO'::public.estado_mantenimiento
           WHEN m.ultimo_pago IS NOT NULL
             THEN 'AL_DIA'::public.estado_mantenimiento
           ELSE 'PENDIENTE'::public.estado_mantenimiento
         END;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.refrescar_estados_mantenimiento() IS
  'Recalcula el estado de mantenimiento de todos los administradores a partir de sus fechas. Respeta EXENTO. Devuelve cuantas filas cambiaron.';

REVOKE ALL ON FUNCTION public.refrescar_estados_mantenimiento() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.refrescar_estados_mantenimiento()
  TO authenticated, service_role;

COMMIT;

SELECT public.refrescar_estados_mantenimiento() AS filas_actualizadas;
