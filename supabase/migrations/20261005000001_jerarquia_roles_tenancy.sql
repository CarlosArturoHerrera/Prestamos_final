-- =============================================================================
-- Jerarquía de usuarios: MEGAADMINISTRADOR → ADMINISTRADOR → SUBUSUARIO
--
-- Fase 1 de 3. Esta migración es ADITIVA y NO DESTRUCTIVA:
--   • No borra ninguna fila ni columna existente.
--   • No toca ninguna lógica financiera (finance.ts / prestamo-logic.ts ni las
--     tablas abonos / reganches / intereses_atrasados en su contenido).
--   • Sólo añade columnas nullable, tablas nuevas y funciones de autorización.
--
-- Mapeo con los roles ya existentes en el proyecto (se REUTILIZAN, no se
-- duplican):
--   MEGAADMINISTRADOR → profiles.role = 'super_admin'   (ya existía)
--   ADMINISTRADOR     → profiles.role = 'admin'         (ya existía)
--   SUBUSUARIO        → profiles.role = 'sub_user'      (nuevo)
--
-- Clave de tenant: profiles.admin_id
--   super_admin → NULL      (acceso global, no pertenece a ningún tenant)
--   admin       → NULL      (él mismo ES el tenant; su tenant_id es su propio id)
--   sub_user    → id del administrador propietario (obligatorio)
--
-- El hash de contraseña NO se almacena aquí: lo gestiona Supabase Auth en
-- auth.users.encrypted_password (bcrypt). Nunca se guarda texto plano.
-- =============================================================================

BEGIN;

-- ── 1. profiles: nuevo rol y columnas de identidad ──────────────────────────

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'sub_user'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_id   uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cedula     text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefono   text;

-- admin_id apunta al administrador propietario (sólo lo usan los sub_user).
-- ON DELETE CASCADE: si se elimina un administrador, sus subusuarios también.
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES public.profiles (id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- username único e insensible a mayúsculas (login alternativo al email).
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_id ON public.profiles (admin_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role     ON public.profiles (role);

-- Coherencia de la jerarquía, garantizada por la base de datos:
--   sub_user      → admin_id OBLIGATORIO y distinto de sí mismo
--   admin/super   → admin_id SIEMPRE NULL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_hierarchy_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hierarchy_check CHECK (
    (role = 'sub_user' AND admin_id IS NOT NULL AND admin_id <> id)
    OR (role IN ('admin', 'super_admin') AND admin_id IS NULL)
  );

-- full_name se mantiene como campo de visualización ya usado por la app.
-- Este trigger lo deriva de first_name/last_name cuando éstos se informan,
-- evitando duplicar la fuente de verdad sin romper el código existente.
CREATE OR REPLACE FUNCTION public.sync_profile_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
    NEW.full_name := nullif(
      btrim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')),
      ''
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_full_name ON public.profiles;
CREATE TRIGGER trg_sync_profile_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_full_name();

-- Un sub_user nunca puede "ascender": ni cambiar su propio rol ni cambiar de
-- administrador. Sólo service_role (auth.uid() IS NULL) puede reasignar.
CREATE OR REPLACE FUNCTION public.prevent_hierarchy_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / procesos internos: sin sesión, se permite.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nadie puede cambiar su propio rol (§29).
  IF NEW.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;

  -- Nadie puede cambiar su propio administrador propietario.
  IF NEW.id = auth.uid() AND NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
    RAISE EXCEPTION 'No puedes cambiar tu administrador propietario';
  END IF;

  -- Un administrador no puede mover un subusuario fuera de su organización
  -- ni convertirlo en admin/super_admin.
  IF OLD.role = 'sub_user' AND NOT public.is_super_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Sólo el megaadministrador puede cambiar el rol de un subusuario';
    END IF;
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
      RAISE EXCEPTION 'No puedes reasignar un subusuario a otro administrador';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_hierarchy_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_hierarchy_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hierarchy_escalation();

-- handle_new_user() ya existía y creaba SIEMPRE el perfil con role='admin'.
-- Con la jerarquía eso daría a cada subusuario recién creado un instante de
-- vida como administrador con tenant propio. Se reemplaza para que honre el
-- rol y el administrador propietario enviados en user_metadata por la ruta de
-- creación (que corre con service_role). Sin metadata, el comportamiento es
-- exactamente el anterior: role='admin'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := coalesce(new.raw_user_meta_data->>'app_role', 'admin');
  v_admin_id uuid;
BEGIN
  IF v_role NOT IN ('super_admin', 'admin', 'sub_user') THEN
    v_role := 'admin';
  END IF;

  IF v_role = 'sub_user' THEN
    BEGIN
      v_admin_id := (new.raw_user_meta_data->>'admin_id')::uuid;
    EXCEPTION WHEN others THEN
      v_admin_id := NULL;
    END;
    -- Un sub_user sin administrador válido violaría profiles_hierarchy_check;
    -- se degrada a 'admin' y la ruta de creación corrige/aborta después.
    IF v_admin_id IS NULL THEN
      v_role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, role, admin_id, email, full_name, first_name, last_name,
    username, cedula, telefono, is_active
  )
  VALUES (
    new.id,
    v_role,
    CASE WHEN v_role = 'sub_user' THEN v_admin_id ELSE NULL END,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      NULL
    ),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'cedula',
    new.raw_user_meta_data->>'telefono',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Catálogo de permisos y asignación por subusuario ─────────────────────

CREATE TABLE IF NOT EXISTS public.permissions (
  code        text PRIMARY KEY,
  module      text NOT NULL,
  label       text NOT NULL,
  description text,
  sort_order  int  NOT NULL DEFAULT 0
);

-- Permisos derivados de los módulos REALES del sistema
-- (Dashboard, Empresas, Representantes, Clientes, Préstamos, Notificaciones,
--  Reportes) y de las operaciones que exponen las rutas API existentes.
INSERT INTO public.permissions (code, module, label, description, sort_order) VALUES
  ('dashboard.ver',        'dashboard',      'Ver dashboard',              'Acceder al panel principal y sus métricas', 10),

  ('empresas.ver',         'empresas',       'Ver empresas',               'Listar y consultar empresas',               20),
  ('empresas.crear',       'empresas',       'Crear empresas',             'Registrar nuevas empresas',                 21),
  ('empresas.editar',      'empresas',       'Editar empresas',            'Modificar datos de empresas',               22),
  ('empresas.eliminar',    'empresas',       'Eliminar empresas',          'Borrar empresas',                           23),

  ('representantes.ver',      'representantes', 'Ver representantes',      'Listar y consultar representantes',         30),
  ('representantes.crear',    'representantes', 'Crear representantes',    'Registrar nuevos representantes',           31),
  ('representantes.editar',   'representantes', 'Editar representantes',   'Modificar datos de representantes',         32),
  ('representantes.eliminar', 'representantes', 'Eliminar representantes', 'Borrar representantes',                     33),
  ('representantes.ganancias','representantes', 'Ver ganancias',           'Consultar el desglose de ganancias',        34),

  ('clientes.ver',         'clientes',       'Ver clientes',               'Listar y consultar clientes',               40),
  ('clientes.crear',       'clientes',       'Crear clientes',             'Registrar nuevos clientes',                 41),
  ('clientes.editar',      'clientes',       'Editar clientes',            'Modificar datos de clientes',               42),
  ('clientes.eliminar',    'clientes',       'Eliminar clientes',          'Borrar clientes',                           43),

  ('prestamos.ver',        'prestamos',      'Ver préstamos',              'Listar y consultar préstamos',              50),
  ('prestamos.crear',      'prestamos',      'Crear préstamos',            'Registrar nuevos préstamos',                51),
  ('prestamos.editar',     'prestamos',      'Editar préstamos',           'Modificar préstamos y aplicar reganches',   52),
  ('prestamos.eliminar',   'prestamos',      'Eliminar préstamos',         'Borrar préstamos',                          53),
  ('prestamos.saldar',     'prestamos',      'Saldar préstamos',           'Marcar un préstamo como saldado',           54),

  ('abonos.ver',           'abonos',         'Ver abonos',                 'Consultar el historial de pagos',           60),
  ('abonos.crear',         'abonos',         'Registrar abonos',           'Registrar pagos de capital e interés',      61),
  ('abonos.editar',        'abonos',         'Editar abonos',              'Modificar o anular abonos',                 62),

  ('cobranza.ver',         'cobranza',       'Ver gestión de cobranza',    'Consultar el seguimiento de cobranza',      70),
  ('cobranza.crear',       'cobranza',       'Registrar gestión',          'Añadir notas y promesas de pago',           71),
  ('cobranza.editar',      'cobranza',       'Editar gestión',             'Modificar registros de cobranza',           72),

  ('notificaciones.ver',   'notificaciones', 'Ver notificaciones',         'Consultar el historial de envíos',          80),
  ('notificaciones.enviar','notificaciones', 'Enviar notificaciones',      'Enviar mensajes por WhatsApp / email',      81),

  ('reportes.ver',         'reportes',       'Ver reportes',               'Consultar reportes de cartera',             90),
  ('reportes.exportar',    'reportes',       'Exportar reportes',          'Descargar reportes en Excel / PDF',         91),

  ('subusuarios.ver',      'configuracion',  'Ver subusuarios',            'Listar los subusuarios de la organización', 100),
  ('configuracion.ver',    'configuracion',  'Ver configuración',          'Acceder a la configuración de la cuenta',   101)
ON CONFLICT (code) DO UPDATE
  SET module      = EXCLUDED.module,
      label       = EXCLUDED.label,
      description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id         uuid NOT NULL REFERENCES public.profiles (id)   ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions (code) ON DELETE CASCADE,
  granted_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions (user_id);

-- ── 3. Funciones de autorización (SECURITY DEFINER) ─────────────────────────
-- Todas son STABLE + SECURITY DEFINER + search_path fijo: leen profiles sin
-- disparar RLS recursivo y Postgres las cachea dentro de una misma sentencia.

-- Rol efectivo del usuario autenticado.
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- TRUE sólo para el megaadministrador activo.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

-- TRUE sólo para un administrador activo (no megaadmin, no subusuario).
CREATE OR REPLACE FUNCTION public.is_admin_only()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- Tenant efectivo del usuario autenticado — la pieza central del aislamiento.
--
--   admin activo     → su propio id
--   sub_user activo  → admin_id, SIEMPRE QUE su administrador esté activo (§11)
--   super_admin      → NULL (no pertenece a ningún tenant; su acceso global se
--                      concede explícitamente con is_super_admin() en las RLS)
--   cuenta inactiva  → NULL  → ninguna fila le cuadra → cero acceso
--
-- Que devuelva NULL para una cuenta deshabilitada es lo que hace que al
-- deshabilitar un administrador sus subusuarios pierdan el acceso al instante,
-- sin tocar ni una fila de datos.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
           WHEN me.role = 'admin'    THEN me.id
           WHEN me.role = 'sub_user' THEN padre.id
           ELSE NULL
         END
  FROM public.profiles me
  LEFT JOIN public.profiles padre
         ON padre.id = me.admin_id
        AND padre.role = 'admin'
        AND padre.is_active = true
  WHERE me.id = auth.uid()
    AND me.is_active = true
  LIMIT 1;
$$;

-- TRUE cuando el usuario puede operar sobre datos de negocio en general:
-- megaadmin, administrador activo, o subusuario de un administrador activo.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin() OR public.current_tenant_id() IS NOT NULL;
$$;

-- Comprobación de permiso granular (§14).
--   super_admin / admin → TRUE siempre (permisos completos sobre su ámbito)
--   sub_user            → sólo si tiene el permiso concedido explícitamente
--   inactivo / sin padre activo → FALSE
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN true
    WHEN public.current_tenant_id() IS NULL THEN false
    WHEN public.get_current_role() = 'admin' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid() AND up.permission_code = p_code
    )
  END;
$$;

-- Contexto completo de la sesión en una sola llamada. Lo consume
-- getUserAndRole() en src/lib/api-auth.ts: sin esto harían falta tres
-- consultas (perfil, administrador padre, permisos) en CADA petición.
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
    -- Un administrador deshabilitado arrastra a sus subusuarios (§11).
    'parentActive', CASE
                      WHEN me.role <> 'sub_user' THEN true
                      ELSE coalesce(padre.is_active, false)
                    END,
    'permissions', CASE
                     WHEN me.role IN ('admin', 'super_admin')
                       THEN (SELECT coalesce(jsonb_agg(pm.code), '[]'::jsonb) FROM public.permissions pm)
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

REVOKE ALL ON FUNCTION public.session_context() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.session_context() TO authenticated, service_role;

COMMENT ON FUNCTION public.current_tenant_id() IS
  'Administrador propietario del usuario autenticado. NULL para megaadmin, cuentas inactivas y subusuarios cuyo administrador está deshabilitado.';
COMMENT ON FUNCTION public.has_permission(text) IS
  'Permiso granular. Administradores y megaadmin reciben TRUE; los subusuarios sólo con concesión explícita en user_permissions.';

-- ── 4. Columnas de tenant en las tablas de negocio ──────────────────────────
-- Nullable a propósito: las filas existentes quedan con admin_id = NULL y las
-- RLS de la fase 2 las ocultan a todos salvo al megaadministrador, de modo que
-- NADA se pierde y NADA se filtra mientras no se ejecute el backfill.

ALTER TABLE public.empresas          ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.representantes    ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.clientes          ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.prestamos         ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.notificaciones    ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.gestion_cobranza  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_empresas_admin         ON public.empresas (admin_id);
CREATE INDEX IF NOT EXISTS idx_representantes_admin   ON public.representantes (admin_id);
CREATE INDEX IF NOT EXISTS idx_clientes_admin         ON public.clientes (admin_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_admin        ON public.prestamos (admin_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_admin   ON public.notificaciones (admin_id);
CREATE INDEX IF NOT EXISTS idx_gestion_cobranza_admin ON public.gestion_cobranza (admin_id);

-- empresas.nombre era UNIQUE global; con multi-tenant dos administradores
-- distintos deben poder tener una empresa con el mismo nombre.
-- Se sustituye por un índice único POR TENANT. No se pierde ningún dato:
-- el constraint anterior era más estricto, así que todo lo existente lo cumple.
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_nombre_key;
-- Se indexa `nombre` tal cual, NO lower(nombre): la restricción anterior era
-- sensible a mayúsculas, así que podrían convivir "Elicar" y "ELICAR" y un
-- índice sobre lower() haría fallar la migración con datos perfectamente
-- válidos. Replicamos exactamente la semántica previa, pero por organización.
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_nombre_por_admin
  ON public.empresas (admin_id, nombre);

-- Igual para la cédula del cliente: única dentro de cada organización.
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_cedula_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_cedula_por_admin
  ON public.clientes (admin_id, cedula);

-- ── 5. Triggers de estampado de tenant ──────────────────────────────────────
-- §15 y §17: el propietario lo determina SIEMPRE el backend a partir de la
-- sesión autenticada. Un admin_id enviado desde el frontend se ignora y se
-- sobrescribe. Esto hace que las ~50 rutas API existentes queden aisladas sin
-- modificar una sola línea de su código.

-- Tablas raíz: el tenant sale de la sesión.
CREATE OR REPLACE FUNCTION public.stamp_tenant_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- El propietario de una fila nunca cambia desde la aplicación.
    -- service_role (auth.uid() IS NULL) sí puede: lo necesita el backfill.
    IF NEW.admin_id IS DISTINCT FROM OLD.admin_id
       AND auth.uid() IS NOT NULL
       AND NOT public.is_super_admin() THEN
      NEW.admin_id := OLD.admin_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_tenant IS NOT NULL THEN
    -- Admin o subusuario: se fuerza su propio tenant, venga lo que venga.
    NEW.admin_id := v_tenant;
  ELSIF public.is_super_admin() OR auth.uid() IS NULL THEN
    -- Megaadmin o service_role: debe indicar explícitamente el propietario.
    IF NEW.admin_id IS NULL THEN
      RAISE EXCEPTION
        'Falta admin_id: el megaadministrador debe indicar el administrador propietario al crear registros en %', TG_TABLE_NAME;
    END IF;
  ELSE
    RAISE EXCEPTION 'Sesión sin organización asignada: no se pueden crear registros';
  END IF;

  RETURN NEW;
END;
$$;

-- prestamos: el tenant se DERIVA del cliente, nunca de la petición.
CREATE OR REPLACE FUNCTION public.stamp_tenant_from_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT c.admin_id INTO v_owner FROM public.clientes c WHERE c.id = NEW.cliente_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'El cliente % no tiene administrador propietario asignado', NEW.cliente_id;
  END IF;
  NEW.admin_id := v_owner;
  RETURN NEW;
END;
$$;

-- gestion_cobranza: igual, derivado del cliente.
CREATE OR REPLACE FUNCTION public.stamp_tenant_gestion_cobranza()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT c.admin_id INTO v_owner FROM public.clientes c WHERE c.id = NEW.cliente_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'El cliente % no tiene administrador propietario asignado', NEW.cliente_id;
  END IF;
  NEW.admin_id := v_owner;
  RETURN NEW;
END;
$$;

-- notificaciones: derivado del representante.
CREATE OR REPLACE FUNCTION public.stamp_tenant_from_representante()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT r.admin_id INTO v_owner FROM public.representantes r WHERE r.id = NEW.representante_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'El representante % no tiene administrador propietario asignado', NEW.representante_id;
  END IF;
  NEW.admin_id := v_owner;
  RETURN NEW;
END;
$$;

-- clientes: además del estampado, impide coser un cliente a una empresa o a un
-- representante de OTRA organización (vector de fuga entre tenants).
CREATE OR REPLACE FUNCTION public.validate_cliente_tenant_refs()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_rep uuid;
BEGIN
  SELECT e.admin_id INTO v_emp FROM public.empresas       e WHERE e.id = NEW.empresa_id;
  SELECT r.admin_id INTO v_rep FROM public.representantes r WHERE r.id = NEW.representante_id;

  IF v_emp IS DISTINCT FROM NEW.admin_id THEN
    RAISE EXCEPTION 'La empresa seleccionada no pertenece a tu organización';
  END IF;
  IF v_rep IS DISTINCT FROM NEW.admin_id THEN
    RAISE EXCEPTION 'El representante seleccionado no pertenece a tu organización';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_empresas ON public.empresas;
CREATE TRIGGER trg_tenant_empresas
  BEFORE INSERT OR UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_session();

DROP TRIGGER IF EXISTS trg_tenant_representantes ON public.representantes;
CREATE TRIGGER trg_tenant_representantes
  BEFORE INSERT OR UPDATE ON public.representantes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_session();

DROP TRIGGER IF EXISTS trg_tenant_clientes ON public.clientes;
CREATE TRIGGER trg_tenant_clientes
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_session();

-- Se ejecuta DESPUÉS del estampado (orden alfabético de nombre de trigger:
-- "trg_tenant_clientes" < "trg_tenant_clientes_refs").
DROP TRIGGER IF EXISTS trg_tenant_clientes_refs ON public.clientes;
CREATE TRIGGER trg_tenant_clientes_refs
  BEFORE INSERT OR UPDATE OF empresa_id, representante_id, admin_id ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.validate_cliente_tenant_refs();

DROP TRIGGER IF EXISTS trg_tenant_prestamos ON public.prestamos;
CREATE TRIGGER trg_tenant_prestamos
  BEFORE INSERT OR UPDATE OF cliente_id, admin_id ON public.prestamos
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_cliente();

DROP TRIGGER IF EXISTS trg_tenant_gestion_cobranza ON public.gestion_cobranza;
CREATE TRIGGER trg_tenant_gestion_cobranza
  BEFORE INSERT OR UPDATE OF cliente_id, admin_id ON public.gestion_cobranza
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_gestion_cobranza();

DROP TRIGGER IF EXISTS trg_tenant_notificaciones ON public.notificaciones;
CREATE TRIGGER trg_tenant_notificaciones
  BEFORE INSERT OR UPDATE OF representante_id, admin_id ON public.notificaciones
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_representante();

-- ── 6. Backfill asistido (NO se ejecuta automáticamente) ────────────────────
-- Asigna todas las filas huérfanas a un administrador. Es idempotente y sólo
-- toca filas con admin_id IS NULL: jamás reasigna datos ya atribuidos.
-- La llama scripts/bootstrap-jerarquia.js tras crear el administrador dueño.
CREATE OR REPLACE FUNCTION public.asignar_datos_sin_propietario(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'El destino % no es un administrador válido', p_admin_id;
  END IF;

  -- Orden importante: padres antes que hijos, para que los triggers de
  -- validación encuentren el propietario ya asignado.
  UPDATE public.empresas       SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('empresas', n);

  UPDATE public.representantes SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('representantes', n);

  UPDATE public.clientes       SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('clientes', n);

  UPDATE public.prestamos      SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('prestamos', n);

  UPDATE public.notificaciones SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('notificaciones', n);

  UPDATE public.gestion_cobranza SET admin_id = p_admin_id WHERE admin_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('gestion_cobranza', n);

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.asignar_datos_sin_propietario(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asignar_datos_sin_propietario(uuid) TO service_role;

-- ── 7. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.permissions, public.user_permissions TO service_role;
REVOKE ALL ON public.permissions, public.user_permissions FROM anon;

COMMIT;
