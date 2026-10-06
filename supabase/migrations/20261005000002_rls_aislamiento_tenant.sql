-- =============================================================================
-- Fase 2: Aislamiento de datos por administrador (multi-tenant) vía RLS.
--
-- Estrategia — por qué policies RESTRICTIVE
-- -----------------------------------------
-- El proyecto ya tiene, por cada tabla de negocio, una policy PERMISSIVE
-- `<tabla>_all_admins` con USING (is_admin()). En Postgres:
--
--   • Las policies PERMISSIVE se combinan entre sí con OR.
--   • Cada policy RESTRICTIVE se aplica además con AND.
--
-- Añadiendo restrictivas encima no hay que reescribir ni una sola policy
-- existente, y el filtro de tenant se vuelve inevitable: aunque mañana alguien
-- añada una permissive demasiado laxa, la restrictiva sigue cortando.
-- Es el mismo patrón que ya usa 20260819000001_prestamos_delete_super_admin.sql.
--
-- Consecuencia directa y buscada (§18, protección IDOR): un GET
-- /api/clientes/123 de otra organización no devuelve la fila — `.single()`
-- falla y la ruta responde 404/400 sin filtrar absolutamente nada. No hace
-- falta tocar las ~50 rutas API para que dejen de ser vulnerables.
--
-- Filas con admin_id IS NULL (datos previos al backfill): `NULL = algo` es
-- NULL, nunca TRUE, así que quedan invisibles para todo administrador y sólo
-- las ve el megaadministrador. Ningún dato se borra, ninguno se filtra.
--
-- NO se modifica ningún cálculo financiero: esto sólo decide QUÉ FILAS ve cada
-- sesión, nunca cómo se calculan intereses, capital, abonos ni comisiones.
-- =============================================================================

BEGIN;

-- ── 1. Tablas raíz: aislamiento por columna admin_id ────────────────────────
-- super_admin pasa siempre (acceso global, §2).

DROP POLICY IF EXISTS "empresas_tenant_isolation" ON public.empresas;
CREATE POLICY "empresas_tenant_isolation" ON public.empresas
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "representantes_tenant_isolation" ON public.representantes;
CREATE POLICY "representantes_tenant_isolation" ON public.representantes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "clientes_tenant_isolation" ON public.clientes;
CREATE POLICY "clientes_tenant_isolation" ON public.clientes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "prestamos_tenant_isolation" ON public.prestamos;
CREATE POLICY "prestamos_tenant_isolation" ON public.prestamos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "notificaciones_tenant_isolation" ON public.notificaciones;
CREATE POLICY "notificaciones_tenant_isolation" ON public.notificaciones
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "gestion_cobranza_tenant_isolation" ON public.gestion_cobranza;
CREATE POLICY "gestion_cobranza_tenant_isolation" ON public.gestion_cobranza
  AS RESTRICTIVE FOR ALL TO authenticated
  USING      (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

-- ── 2. Tablas hijas del préstamo: aislamiento heredado ──────────────────────
-- abonos, reganches e intereses_atrasados NO llevan columna admin_id: su
-- propietario es, por definición, el del préstamo. Derivarlo con EXISTS evita
-- denormalizar datos financieros y hace imposible que se desincronicen.
-- El índice (prestamo_id) ya existe en las tres tablas, así que el EXISTS
-- resuelve por índice primario de prestamos.

DROP POLICY IF EXISTS "abonos_tenant_isolation" ON public.abonos;
CREATE POLICY "abonos_tenant_isolation" ON public.abonos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = abonos.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = abonos.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "reganches_tenant_isolation" ON public.reganches;
CREATE POLICY "reganches_tenant_isolation" ON public.reganches
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = reganches.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = reganches.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "intereses_atrasados_tenant_isolation" ON public.intereses_atrasados;
CREATE POLICY "intereses_atrasados_tenant_isolation" ON public.intereses_atrasados
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = intereses_atrasados.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.prestamos p
      WHERE p.id = intereses_atrasados.prestamo_id AND p.admin_id = public.current_tenant_id()
    )
  );

-- ── 3. Permisos granulares de subusuario, a nivel de base de datos (§14) ────
-- has_permission() devuelve TRUE automáticamente para admin y super_admin, así
-- que estas restrictivas sólo muerden a los subusuarios. Se generan en bucle
-- para que el catálogo quede en un único sitio legible.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('empresas',            'empresas.ver',        'empresas.crear',        'empresas.editar',        'empresas.eliminar'),
      ('representantes',      'representantes.ver',  'representantes.crear',  'representantes.editar',  'representantes.eliminar'),
      ('clientes',            'clientes.ver',        'clientes.crear',        'clientes.editar',        'clientes.eliminar'),
      ('prestamos',           'prestamos.ver',       'prestamos.crear',       'prestamos.editar',       'prestamos.eliminar'),
      ('abonos',              'abonos.ver',          'abonos.crear',          'abonos.editar',          'abonos.editar'),
      ('reganches',           'prestamos.ver',       'prestamos.editar',      'prestamos.editar',       'prestamos.eliminar'),
      ('intereses_atrasados', 'prestamos.ver',       'prestamos.editar',      'prestamos.editar',       'prestamos.eliminar'),
      ('gestion_cobranza',    'cobranza.ver',        'cobranza.crear',        'cobranza.editar',        'cobranza.editar'),
      ('notificaciones',      'notificaciones.ver',  'notificaciones.enviar', 'notificaciones.enviar',  'notificaciones.enviar')
    ) AS v(tabla, p_select, p_insert, p_update, p_delete)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabla || '_perm_select', t.tabla);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_permission(%L))',
      t.tabla || '_perm_select', t.tabla, t.p_select);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabla || '_perm_insert', t.tabla);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_permission(%L))',
      t.tabla || '_perm_insert', t.tabla, t.p_insert);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabla || '_perm_update', t.tabla);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
      t.tabla || '_perm_update', t.tabla, t.p_update, t.p_update);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.tabla || '_perm_delete', t.tabla);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_permission(%L))',
      t.tabla || '_perm_delete', t.tabla, t.p_delete);
  END LOOP;
END $$;

-- ── 4. profiles: visibilidad dentro de la jerarquía ─────────────────────────
-- Se reemplazan las policies de profiles para contemplar los subusuarios.
--   super_admin → ve y gestiona todos los perfiles
--   admin       → ve su propio perfil y el de SUS subusuarios, y los gestiona
--   sub_user    → ve únicamente su propio perfil
--
-- Nota: las rutas /api/admin/* usan service_role y bypassean RLS; esto es la
-- segunda línea de defensa frente a un cliente PostgREST directo.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete"     ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (role = 'sub_user' AND admin_id = public.current_tenant_id())
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: el megaadmin sobre cualquiera; un administrador SÓLO sobre sus
-- propios subusuarios (nunca sobre sí mismo ni sobre otros administradores).
-- WITH CHECK repite la condición para que la fila resultante siga siendo suya.
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (role = 'sub_user' AND admin_id = public.current_tenant_id() AND public.is_admin_only())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (role = 'sub_user' AND admin_id = public.current_tenant_id() AND public.is_admin_only())
  );

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (role = 'sub_user' AND admin_id = public.current_tenant_id() AND public.is_admin_only())
  );

-- ── 5. user_permissions: cada administrador gestiona los de sus subusuarios ─

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions_select" ON public.user_permissions;
CREATE POLICY "user_permissions_select" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_permissions.user_id
        AND p.role = 'sub_user'
        AND p.admin_id = public.current_tenant_id()
    )
  );

-- Escritura: sólo el megaadmin o el administrador dueño del subusuario.
-- Un subusuario NUNCA puede concederse permisos a sí mismo (§29).
DROP POLICY IF EXISTS "user_permissions_write" ON public.user_permissions;
CREATE POLICY "user_permissions_write" ON public.user_permissions
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.is_admin_only() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_permissions.user_id
        AND p.role = 'sub_user'
        AND p.admin_id = public.current_tenant_id()
    ))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_admin_only() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_permissions.user_id
        AND p.role = 'sub_user'
        AND p.admin_id = public.current_tenant_id()
    ))
  );

-- ── 6. permissions: catálogo de sólo lectura ────────────────────────────────

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select_all" ON public.permissions;
CREATE POLICY "permissions_select_all" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Sin policies de escritura: el catálogo sólo se modifica por migración.

-- ── 7. Cierre de superficie para anon ───────────────────────────────────────
-- La migración original de microfinanzas hizo GRANT ALL ON ALL TABLES a anon.
-- Ninguna tabla de negocio debe ser alcanzable sin autenticar.

REVOKE ALL ON public.clientes            FROM anon;
REVOKE ALL ON public.prestamos           FROM anon;
REVOKE ALL ON public.abonos              FROM anon;
REVOKE ALL ON public.reganches           FROM anon;
REVOKE ALL ON public.intereses_atrasados FROM anon;
REVOKE ALL ON public.gestion_cobranza    FROM anon;
REVOKE ALL ON public.notificaciones      FROM anon;
REVOKE ALL ON public.profiles            FROM anon;

COMMIT;
