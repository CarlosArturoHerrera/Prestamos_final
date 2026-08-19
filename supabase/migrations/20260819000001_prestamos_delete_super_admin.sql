-- =============================================================================
-- Eliminación de préstamos: reservada a super_admin.
--
-- La policy existente `prestamos_all_admins` es FOR ALL con is_admin(), así que
-- hoy un admin podría borrar vía PostgREST. En lugar de reescribirla (lo que
-- tocaría SELECT/INSERT/UPDATE de todo el módulo), se añade una policy
-- RESTRICTIVE: las permisivas se combinan con OR entre ellas, pero cada
-- restrictiva se aplica con AND. Resultado: SELECT/INSERT/UPDATE se comportan
-- exactamente igual que antes y sólo DELETE pasa a exigir super_admin, también
-- para quien llame a la API o a la base de datos directamente.
--
-- No hace falta ningún cambio de esquema: las filas dependientes ya tienen su
-- comportamiento definido —abonos, reganches e intereses_atrasados con
-- `on delete cascade`, gestion_cobranza con `on delete set null`—. El cascade
-- lo ejecuta el sistema de integridad referencial, que no evalúa RLS sobre las
-- tablas hijas, así que el borrado funciona sin ampliar permisos en ellas.
-- =============================================================================

DROP POLICY IF EXISTS "prestamos_delete_super_admin_only" ON public.prestamos;

CREATE POLICY "prestamos_delete_super_admin_only"
  ON public.prestamos
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
