-- =============================================================================
-- Fase 3: Mantenimiento mensual, mensajes del megaadministrador y auditoría.
--
-- Nada de lo que hay aquí toca la cartera ni la lógica financiera: son tablas
-- nuevas de administración de la plataforma.
--
-- El restablecimiento de contraseña (§24) NO necesita tabla propia: el proyecto
-- ya genera enlaces de un solo uso con expiración mediante
-- supabase.auth.admin.generateLink({type:'recovery'}) y los entrega por Resend
-- (ver src/app/api/admin/users/[id]/route.ts). Se reutiliza tal cual (§36).
-- =============================================================================

BEGIN;

-- ── 1. Mantenimiento mensual por administrador (§21) ────────────────────────

DO $$
BEGIN
  CREATE TYPE public.estado_mantenimiento AS ENUM (
    'AL_DIA',     -- pagado, nada pendiente
    'PENDIENTE',  -- hay un pago por vencer
    'VENCIDO',    -- pasó la fecha y no se registró el pago
    'EXENTO'      -- administrador sin cobro de mantenimiento
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1:1 con el perfil del administrador.
CREATE TABLE IF NOT EXISTS public.admin_maintenance (
  admin_id          uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  estado            public.estado_mantenimiento NOT NULL DEFAULT 'PENDIENTE',
  dia_pago          int CHECK (dia_pago BETWEEN 1 AND 31),
  monto             numeric(18, 2) CHECK (monto >= 0),
  ultimo_pago       date,
  proximo_pago      date,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_admin_maintenance_updated ON public.admin_maintenance;
CREATE TRIGGER trg_admin_maintenance_updated
  BEFORE UPDATE ON public.admin_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Historial de pagos de mantenimiento. Es un registro administrativo de la
-- plataforma, completamente separado de abonos/préstamos de la cartera.
CREATE TABLE IF NOT EXISTS public.admin_maintenance_payments (
  id            bigserial PRIMARY KEY,
  admin_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  monto         numeric(18, 2) NOT NULL CHECK (monto >= 0),
  fecha_pago    date NOT NULL DEFAULT current_date,
  periodo       date,          -- mes que cubre el pago (día 1 del mes)
  metodo        text,
  notas         text,
  registrado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_payments_admin
  ON public.admin_maintenance_payments (admin_id, fecha_pago DESC);

-- Calcula la siguiente fecha de pago a partir del día configurado.
-- Si el día no existe en el mes destino (p. ej. 31 en febrero), se usa el
-- último día de ese mes. Es una función de calendario pura, sin dinero.
CREATE OR REPLACE FUNCTION public.calcular_proximo_pago(p_dia int, p_desde date)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  WITH b AS (
    SELECT
      -- primer día del mes SIGUIENTE al de p_desde
      (date_trunc('month', p_desde::timestamp) + interval '1 month')::date AS inicio,
      -- número de días que tiene ese mes siguiente
      extract(
        day FROM (date_trunc('month', p_desde::timestamp) + interval '2 month' - interval '1 day')
      )::int AS dias
  )
  SELECT CASE
           WHEN p_dia IS NULL THEN NULL
           ELSE b.inicio + (least(p_dia, b.dias) - 1)
         END
  FROM b;
$$;

COMMENT ON FUNCTION public.calcular_proximo_pago(int, date) IS
  'Día p_dia del mes siguiente a p_desde, recortado al último día del mes cuando no existe (31 en febrero → 28/29).';

-- Recalcula el estado de mantenimiento de un administrador.
-- Sin fecha configurada → PENDIENTE. Con fecha pasada → VENCIDO.
-- EXENTO nunca se recalcula: es una decisión manual del megaadministrador.
CREATE OR REPLACE FUNCTION public.refrescar_estado_mantenimiento(p_admin_id uuid)
RETURNS public.estado_mantenimiento
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.admin_maintenance;
  nuevo public.estado_mantenimiento;
BEGIN
  SELECT * INTO m FROM public.admin_maintenance WHERE admin_id = p_admin_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF m.estado = 'EXENTO' THEN RETURN 'EXENTO'; END IF;

  IF m.proximo_pago IS NULL THEN
    nuevo := 'PENDIENTE';
  ELSIF m.proximo_pago < current_date THEN
    nuevo := 'VENCIDO';
  ELSIF m.ultimo_pago IS NOT NULL AND m.proximo_pago >= current_date THEN
    nuevo := 'AL_DIA';
  ELSE
    nuevo := 'PENDIENTE';
  END IF;

  UPDATE public.admin_maintenance
    SET estado = nuevo, updated_at = now()
    WHERE admin_id = p_admin_id;

  RETURN nuevo;
END;
$$;

-- Registrar un pago: añade al historial y avanza la fecha del siguiente cobro.
-- Reservada al megaadministrador.
CREATE OR REPLACE FUNCTION public.registrar_pago_mantenimiento(
  p_admin_id uuid,
  p_monto    numeric,
  p_fecha    date DEFAULT current_date,
  p_metodo   text DEFAULT NULL,
  p_notas    text DEFAULT NULL
)
RETURNS public.admin_maintenance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dia int;
  v_res public.admin_maintenance;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permiso denegado: se requiere megaadministrador';
  END IF;

  INSERT INTO public.admin_maintenance (admin_id) VALUES (p_admin_id)
    ON CONFLICT (admin_id) DO NOTHING;

  INSERT INTO public.admin_maintenance_payments
    (admin_id, monto, fecha_pago, periodo, metodo, notas, registrado_por)
  VALUES
    (p_admin_id, p_monto, p_fecha, date_trunc('month', p_fecha)::date,
     p_metodo, p_notas, auth.uid());

  SELECT dia_pago INTO v_dia FROM public.admin_maintenance WHERE admin_id = p_admin_id;

  UPDATE public.admin_maintenance
    SET ultimo_pago  = p_fecha,
        proximo_pago = public.calcular_proximo_pago(v_dia, p_fecha),
        estado       = CASE WHEN estado = 'EXENTO' THEN 'EXENTO' ELSE 'AL_DIA' END,
        updated_at   = now()
    WHERE admin_id = p_admin_id
    RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_mantenimiento(uuid, numeric, date, text, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_mantenimiento(uuid, numeric, date, text, text)
  TO authenticated, service_role;

-- ── 2. Mensajes personalizados del megaadministrador (§23) ──────────────────

DO $$
BEGIN
  CREATE TYPE public.tipo_mensaje_admin AS ENUM ('INFO', 'ADVERTENCIA', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id          bigserial PRIMARY KEY,
  admin_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  titulo      text NOT NULL,
  cuerpo      text NOT NULL,
  tipo        public.tipo_mensaje_admin NOT NULL DEFAULT 'INFO',
  leido_en    timestamptz,
  expira_en   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_destinatario
  ON public.admin_messages (admin_id, created_at DESC);

-- Índice parcial para la consulta del login: mensajes vigentes sin leer.
CREATE INDEX IF NOT EXISTS idx_admin_messages_pendientes
  ON public.admin_messages (admin_id)
  WHERE leido_en IS NULL;

DROP TRIGGER IF EXISTS trg_admin_messages_updated ON public.admin_messages;
CREATE TRIGGER trg_admin_messages_updated
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- §23: el administrador destinatario puede marcar como leído, pero NUNCA
-- alterar el contenido que le envió el megaadministrador.
CREATE OR REPLACE FUNCTION public.proteger_contenido_mensaje()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.titulo    IS DISTINCT FROM OLD.titulo
     OR NEW.cuerpo    IS DISTINCT FROM OLD.cuerpo
     OR NEW.tipo      IS DISTINCT FROM OLD.tipo
     OR NEW.admin_id  IS DISTINCT FROM OLD.admin_id
     OR NEW.autor_id  IS DISTINCT FROM OLD.autor_id
     OR NEW.expira_en IS DISTINCT FROM OLD.expira_en
  THEN
    RAISE EXCEPTION 'Sólo puedes marcar el mensaje como leído; su contenido no es editable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_contenido_mensaje ON public.admin_messages;
CREATE TRIGGER trg_proteger_contenido_mensaje
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.proteger_contenido_mensaje();

-- ── 3. Auditoría de acciones administrativas (§28) ──────────────────────────
-- Sólo metadatos de la acción. Nunca contraseñas, tokens ni secretos: no hay
-- ninguna columna donde pudieran acabar, y la capa de aplicación filtra el
-- payload antes de escribir.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role  text,
  actor_email text,
  accion      text NOT NULL,       -- p. ej. 'admin.crear', 'subusuario.permisos'
  entidad     text,                -- 'profile' | 'admin_maintenance' | ...
  entidad_id  text,
  admin_id    uuid REFERENCES public.profiles (id) ON DELETE SET NULL, -- tenant afectado
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant  ON public.audit_logs (admin_id, created_at DESC);

-- Append-only: nadie edita ni borra el rastro de auditoría.
CREATE OR REPLACE FUNCTION public.audit_logs_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es de sólo inserción';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();

-- ── 4. RLS de las tablas nuevas ─────────────────────────────────────────────

ALTER TABLE public.admin_maintenance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_maintenance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                 ENABLE ROW LEVEL SECURITY;

-- Mantenimiento: el megaadmin lo gestiona; el administrador sólo LEE el suyo
-- (lo necesita la isla de aviso al iniciar sesión, §22).
DROP POLICY IF EXISTS "admin_maintenance_select" ON public.admin_maintenance;
CREATE POLICY "admin_maintenance_select" ON public.admin_maintenance
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "admin_maintenance_write" ON public.admin_maintenance;
CREATE POLICY "admin_maintenance_write" ON public.admin_maintenance
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admin_maintenance_payments_select" ON public.admin_maintenance_payments;
CREATE POLICY "admin_maintenance_payments_select" ON public.admin_maintenance_payments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "admin_maintenance_payments_write" ON public.admin_maintenance_payments;
CREATE POLICY "admin_maintenance_payments_write" ON public.admin_maintenance_payments
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Mensajes: el destinatario los lee; el trigger de arriba impide que los edite.
DROP POLICY IF EXISTS "admin_messages_select" ON public.admin_messages;
CREATE POLICY "admin_messages_select" ON public.admin_messages
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "admin_messages_update_read" ON public.admin_messages;
CREATE POLICY "admin_messages_update_read" ON public.admin_messages
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR admin_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR admin_id = public.current_tenant_id());

DROP POLICY IF EXISTS "admin_messages_insert" ON public.admin_messages;
CREATE POLICY "admin_messages_insert" ON public.admin_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admin_messages_delete" ON public.admin_messages;
CREATE POLICY "admin_messages_delete" ON public.admin_messages
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Auditoría: sólo la lee el megaadministrador. La escritura real va por
-- service_role desde las rutas API.
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- ── 5. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON public.admin_maintenance, public.admin_maintenance_payments,
                public.admin_messages TO authenticated;
-- UPDATE a nivel de tabla: qué columnas puede tocar cada quien lo deciden la
-- policy admin_messages_update_read y el trigger proteger_contenido_mensaje
-- (el administrador destinatario sólo consigue escribir leido_en).
GRANT INSERT, UPDATE, DELETE ON public.admin_messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_maintenance TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_maintenance_payments TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.admin_maintenance, public.admin_maintenance_payments,
             public.admin_messages, public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_maintenance_payments_id_seq,
                                public.admin_messages_id_seq,
                                public.audit_logs_id_seq TO authenticated, service_role;

REVOKE ALL ON public.admin_maintenance, public.admin_maintenance_payments,
              public.admin_messages, public.audit_logs FROM anon;

COMMIT;
