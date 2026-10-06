-- =============================================================================
-- CORRECCIÓN DEL MODELO DE ACCESO DEL MEGAADMINISTRADOR
--
-- Qué cambia respecto a las migraciones 001–003
-- ---------------------------------------------
-- Aquellas daban al megaadministrador acceso GLOBAL a los datos de negocio:
-- cada policy de aislamiento empezaba por `public.is_super_admin() OR …`.
--
-- Eso era incorrecto. El megaadministrador administra la PLATAFORMA y las
-- CUENTAS de los administradores, pero NO sus datos operativos.
--
--   MEGAADMINISTRADOR  →  cuentas, mantenimiento, mensajes, contraseñas
--                      →  NUNCA clientes, préstamos, abonos, registros
--
-- Cómo se consigue
-- ----------------
-- `current_tenant_id()` ya devuelve NULL para el megaadministrador, porque no
-- pertenece a ninguna organización. Basta con QUITAR la excepción
-- `is_super_admin() OR` de las policies de negocio: la comparación
-- `admin_id = NULL` da NULL, nunca TRUE, así que no le cuadra ninguna fila.
--
-- No es un filtro que se pueda olvidar en una ruta ni desactivar desde la
-- aplicación: es la propia base de datos la que no le devuelve nada.
--
-- Lo que NO cambia
-- ----------------
--   • El aislamiento entre administradores sigue igual.
--   • Los permisos de los subusuarios siguen igual.
--   • profiles, admin_maintenance, admin_messages y audit_logs SÍ siguen
--     siendo accesibles al megaadministrador: son datos de plataforma.
--   • Ni una línea de lógica financiera.
--
-- Esta migración es aditiva y reversible: sólo redefine funciones y policies.
-- =============================================================================

BEGIN;

-- ── 1. is_admin(): deja de incluir al megaadministrador ─────────────────────
-- La usan las policies permisivas `<tabla>_all_admins` heredadas. Al excluir
-- al megaadministrador, queda bloqueado por partida doble: no pasa la
-- permisiva y tampoco la restrictiva de tenant.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Sólo quien pertenece a una organización activa: administrador titular o
  -- subusuario suyo. El megaadministrador devuelve NULL en current_tenant_id()
  -- y por tanto FALSE aquí.
  SELECT public.current_tenant_id() IS NOT NULL;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'TRUE para administradores y subusuarios de una organización activa. FALSE para el megaadministrador: no tiene acceso a datos operativos.';

-- ── 2. Permisos de plataforma ───────────────────────────────────────────────
-- El megaadministrador tiene SU PROPIO conjunto de permisos, referidos a la
-- gestión de cuentas. Deliberadamente NO existe ningún permiso del tipo
-- `clientes.ver_todos` ni equivalente.
INSERT INTO public.permissions (code, module, label, description, sort_order) VALUES
  ('administradores.ver',                 'plataforma', 'Ver administradores',        'Listar y consultar cuentas de administrador', 200),
  ('administradores.crear',               'plataforma', 'Crear administradores',      'Registrar nuevas cuentas de administrador',   201),
  ('administradores.editar',              'plataforma', 'Editar administradores',     'Modificar los datos de la cuenta',            202),
  ('administradores.deshabilitar',        'plataforma', 'Deshabilitar',               'Retirar el acceso sin borrar datos',          203),
  ('administradores.reactivar',           'plataforma', 'Reactivar',                  'Devolver el acceso a una cuenta',             204),
  ('administradores.mantenimiento',       'plataforma', 'Gestionar mantenimiento',    'Día de pago, estado y registro de pagos',     205),
  ('administradores.mensajes',            'plataforma', 'Enviar mensajes',            'Mensajes personalizados al administrador',    206),
  ('administradores.restablecer_password','plataforma', 'Restablecer contraseña',     'Enviar enlace seguro de cambio de clave',     207),
  ('administradores.auditoria',           'plataforma', 'Ver auditoría',              'Consultar el registro de acciones',           208)
ON CONFLICT (code) DO UPDATE
  SET module = EXCLUDED.module, label = EXCLUDED.label,
      description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

-- ── 3. has_permission(): separa plataforma de negocio ───────────────────────
--   megaadministrador → SÓLO permisos 'administradores.*'
--   administrador     → SÓLO permisos de negocio, todos, dentro de su ámbito
--   subusuario        → SÓLO los concedidos explícitamente
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    -- El megaadministrador no recibe NINGÚN permiso de negocio, por mucho que
    -- se le intente conceder: la respuesta se calcula, no se consulta.
    WHEN public.is_super_admin() THEN (p_code LIKE 'administradores.%')
    WHEN public.current_tenant_id() IS NULL THEN false
    -- Un administrador nunca tiene permisos de plataforma.
    WHEN p_code LIKE 'administradores.%' THEN false
    WHEN public.get_current_role() = 'admin' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid() AND up.permission_code = p_code
    )
  END;
$$;

COMMENT ON FUNCTION public.has_permission(text) IS
  'Permisos de plataforma (administradores.*) sólo para el megaadministrador; permisos de negocio sólo dentro de una organización.';

-- ── 4. session_context(): refleja la separación ─────────────────────────────
CREATE OR REPLACE FUNCTION public.session_context()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'userId',      me.id,
    'role',        me.role,
    'isActive',    me.is_active,
    'adminId',     public.current_tenant_id(),
    'email',       me.email,
    'username',    me.username,
    'fullName',    me.full_name,
    'parentActive', CASE
                      WHEN me.role <> 'sub_user' THEN true
                      ELSE coalesce(padre.is_active, false)
                    END,
    'permissions', CASE
                     -- Megaadministrador: únicamente permisos de plataforma.
                     WHEN me.role = 'super_admin' THEN (
                       SELECT coalesce(jsonb_agg(pm.code), '[]'::jsonb)
                       FROM public.permissions pm
                       WHERE pm.module = 'plataforma'
                     )
                     -- Administrador: todos los de negocio, ninguno de plataforma.
                     WHEN me.role = 'admin' THEN (
                       SELECT coalesce(jsonb_agg(pm.code), '[]'::jsonb)
                       FROM public.permissions pm
                       WHERE pm.module <> 'plataforma'
                     )
                     ELSE (
                       SELECT coalesce(jsonb_agg(up.permission_code), '[]'::jsonb)
                       FROM public.user_permissions up
                       WHERE up.user_id = me.id
                     )
                   END
  )
  FROM public.profiles me
  LEFT JOIN public.profiles padre ON padre.id = me.admin_id
  WHERE me.id = auth.uid();
$$;

-- ── 5. Policies de aislamiento SIN la excepción del megaadministrador ───────
-- Éste es el corazón del cambio. Antes: `is_super_admin() OR admin_id = …`.
-- Ahora sólo queda la comparación de tenant.

DROP POLICY IF EXISTS "empresas_tenant_isolation" ON public.empresas;
CREATE POLICY "empresas_tenant_isolation" ON public.empresas
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "representantes_tenant_isolation" ON public.representantes;
CREATE POLICY "representantes_tenant_isolation" ON public.representantes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "clientes_tenant_isolation" ON public.clientes;
CREATE POLICY "clientes_tenant_isolation" ON public.clientes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "prestamos_tenant_isolation" ON public.prestamos;
CREATE POLICY "prestamos_tenant_isolation" ON public.prestamos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "notificaciones_tenant_isolation" ON public.notificaciones;
CREATE POLICY "notificaciones_tenant_isolation" ON public.notificaciones
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "gestion_cobranza_tenant_isolation" ON public.gestion_cobranza;
CREATE POLICY "gestion_cobranza_tenant_isolation" ON public.gestion_cobranza
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (admin_id = public.current_tenant_id())
  WITH CHECK (admin_id = public.current_tenant_id());

-- Tablas hijas del préstamo: heredan por EXISTS, igualmente sin excepción.
DROP POLICY IF EXISTS "abonos_tenant_isolation" ON public.abonos;
CREATE POLICY "abonos_tenant_isolation" ON public.abonos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = abonos.prestamo_id AND p.admin_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = abonos.prestamo_id AND p.admin_id = public.current_tenant_id()
  ));

DROP POLICY IF EXISTS "reganches_tenant_isolation" ON public.reganches;
CREATE POLICY "reganches_tenant_isolation" ON public.reganches
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = reganches.prestamo_id AND p.admin_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = reganches.prestamo_id AND p.admin_id = public.current_tenant_id()
  ));

DROP POLICY IF EXISTS "intereses_atrasados_tenant_isolation" ON public.intereses_atrasados;
CREATE POLICY "intereses_atrasados_tenant_isolation" ON public.intereses_atrasados
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = intereses_atrasados.prestamo_id AND p.admin_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prestamos p
    WHERE p.id = intereses_atrasados.prestamo_id AND p.admin_id = public.current_tenant_id()
  ));

-- ── 6. Borrado de préstamos: del megaadmin al administrador titular ─────────
--
-- CONFLICTO RESUELTO AQUÍ, conviene conocerlo.
-- La migración 20260819000001 reservó el DELETE de préstamos a super_admin.
-- Con el modelo corregido el megaadministrador ya no ve los préstamos, así que
-- esa policy dejaría el borrado IMPOSIBLE PARA TODO EL MUNDO.
--
-- Se traslada el privilegio a quien ahora corresponde: el administrador
-- TITULAR de la organización. Sigue sin estar al alcance de un subusuario
-- cualquiera, que es lo que la policy original protegía.
DROP POLICY IF EXISTS "prestamos_delete_super_admin_only" ON public.prestamos;

DROP POLICY IF EXISTS "prestamos_delete_titular_only" ON public.prestamos;
CREATE POLICY "prestamos_delete_titular_only"
  ON public.prestamos
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.is_admin_only());

-- ── 7. Alta de datos: el megaadministrador tampoco puede crear ──────────────
CREATE OR REPLACE FUNCTION public.stamp_tenant_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- El propietario de una fila no cambia desde la aplicación.
    -- service_role (auth.uid() IS NULL) sí puede: lo necesita el backfill.
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id AND auth.uid() IS NOT NULL THEN
      NEW.admin_id := OLD.admin_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_tenant IS NOT NULL THEN
    -- Administrador o subusuario: se fuerza su tenant, venga lo que venga
    -- en la petición.
    NEW.admin_id := v_tenant;
  ELSIF public.is_super_admin() THEN
    RAISE EXCEPTION
      'El megaadministrador no puede crear registros de negocio: administra cuentas, no cartera';
  ELSIF auth.uid() IS NULL THEN
    -- service_role: scripts de migración y backfill. Debe indicar el dueño.
    IF NEW.admin_id IS NULL THEN
      RAISE EXCEPTION
        'Falta admin_id al crear registros en % desde un proceso sin sesión', TG_TABLE_NAME;
    END IF;
  ELSE
    RAISE EXCEPTION 'Sesión sin organización asignada: no se pueden crear registros';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- ── Verificación ────────────────────────────────────────────────────────────
-- Ninguna policy de negocio debe mencionar ya is_super_admin().
SELECT
  tablename,
  policyname,
  CASE WHEN qual LIKE '%is_super_admin%' OR coalesce(with_check, '') LIKE '%is_super_admin%'
       THEN '*** AÚN DA ACCESO AL MEGAADMIN ***' ELSE 'ok' END AS veredicto
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('empresas','representantes','clientes','prestamos','abonos',
                    'reganches','intereses_atrasados','gestion_cobranza','notificaciones')
ORDER BY tablename, policyname;
