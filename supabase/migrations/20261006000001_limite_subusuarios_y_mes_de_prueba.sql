-- =============================================================================
-- Dos añadidos a la gestión de la plataforma:
--
--   1. LÍMITE DE SUBUSUARIOS por administrador, fijado por el megaadmin.
--   2. Estado de mantenimiento "MES DE PRUEBA": un periodo sin cobro que, al
--      vencer, pasa a VENCIDO y dispara aviso al administrador y al
--      megaadministrador.
--
-- Nada de esto toca la cartera ni ningún cálculo financiero.
-- =============================================================================

-- ── 0. Nuevo valor del enum ─────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE no puede usarse dentro de la misma transacción en
-- la que se emplea el valor nuevo, así que va suelto y antes que todo lo demás.
ALTER TYPE public.estado_mantenimiento ADD VALUE IF NOT EXISTS 'PRUEBA';


BEGIN;

-- ── 1. Límite de subusuarios ────────────────────────────────────────────────
-- NULL = sin límite. Es lo que tienen hoy todos los administradores, así que
-- la columna nace sin cambiar el comportamiento de nadie.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS limite_subusuarios int
  CHECK (limite_subusuarios IS NULL OR limite_subusuarios >= 0);

COMMENT ON COLUMN public.profiles.limite_subusuarios IS
  'Máximo de subusuarios que puede tener este administrador. NULL = sin límite. Sólo lo fija el megaadministrador.';

-- El límite se impone en la BASE DE DATOS, no sólo en la ruta de creación:
-- así no hay forma de saltárselo ni por una condición de carrera entre dos
-- altas simultáneas, ni por una llamada directa a PostgREST.
CREATE OR REPLACE FUNCTION public.validar_limite_subusuarios()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limite int;
  v_actuales int;
BEGIN
  IF NEW.role <> 'sub_user' OR NEW.admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sólo interesa cuando la fila ENTRA en la organización: un UPDATE que no
  -- cambia de administrador ni de rol no consume una plaza nueva.
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'sub_user'
     AND OLD.admin_id IS NOT DISTINCT FROM NEW.admin_id THEN
    RETURN NEW;
  END IF;

  SELECT limite_subusuarios INTO v_limite
    FROM public.profiles WHERE id = NEW.admin_id;

  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_actuales
    FROM public.profiles
   WHERE role = 'sub_user' AND admin_id = NEW.admin_id AND id <> NEW.id;

  IF v_actuales >= v_limite THEN
    RAISE EXCEPTION
      'Límite de subusuarios alcanzado (% de %). El megaadministrador debe ampliarlo.',
      v_actuales, v_limite;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limite_subusuarios ON public.profiles;
CREATE TRIGGER trg_limite_subusuarios
  BEFORE INSERT OR UPDATE OF role, admin_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validar_limite_subusuarios();

-- Bajar el límite por debajo de los subusuarios ya existentes NO los borra ni
-- los bloquea: simplemente impide crear más. Destruir cuentas por un cambio de
-- configuración sería inaceptable.

-- ── 2. Mes de prueba ────────────────────────────────────────────────────────
-- `proximo_pago` marca el FIN del periodo de prueba, igual que marca el
-- vencimiento en los demás estados. Una sola fecha para todo el ciclo.
ALTER TABLE public.admin_maintenance
  ADD COLUMN IF NOT EXISTS aviso_vencimiento_en timestamptz;

COMMENT ON COLUMN public.admin_maintenance.aviso_vencimiento_en IS
  'Cuándo se avisó del vencimiento. Evita repetir el mensaje y el correo en cada refresco.';

-- Recalculo individual, ahora con PRUEBA.
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

  -- EXENTO es una decisión manual y no se recalcula nunca.
  IF m.estado = 'EXENTO' THEN RETURN 'EXENTO'; END IF;

  -- Durante el mes de prueba no se cobra: el estado se mantiene hasta que
  -- llega la fecha de fin.
  IF m.estado = 'PRUEBA' THEN
    IF m.proximo_pago IS NULL OR m.proximo_pago >= current_date THEN
      RETURN 'PRUEBA';
    END IF;
    nuevo := 'VENCIDO';
  ELSIF m.proximo_pago IS NULL THEN
    nuevo := 'PENDIENTE';
  ELSIF m.proximo_pago < current_date THEN
    nuevo := 'VENCIDO';
  ELSIF m.ultimo_pago IS NOT NULL THEN
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

-- Recalculo masivo, con la misma regla.
CREATE OR REPLACE FUNCTION public.refrescar_estados_mantenimiento()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n int := 0;
BEGIN
  WITH calculado AS (
    SELECT m.admin_id,
           CASE
             -- El mes de prueba aguanta hasta su fecha de fin.
             WHEN m.estado = 'PRUEBA'
                  AND (m.proximo_pago IS NULL OR m.proximo_pago >= current_date)
               THEN 'PRUEBA'::public.estado_mantenimiento
             WHEN m.proximo_pago IS NULL
               THEN 'PENDIENTE'::public.estado_mantenimiento
             WHEN m.proximo_pago < current_date
               THEN 'VENCIDO'::public.estado_mantenimiento
             WHEN m.ultimo_pago IS NOT NULL
               THEN 'AL_DIA'::public.estado_mantenimiento
             ELSE 'PENDIENTE'::public.estado_mantenimiento
           END AS nuevo
      FROM public.admin_maintenance m
     WHERE m.estado <> 'EXENTO'
  )
  UPDATE public.admin_maintenance m
     SET estado = c.nuevo, updated_at = now()
    FROM calculado c
   WHERE c.admin_id = m.admin_id
     AND m.estado IS DISTINCT FROM c.nuevo;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Administradores cuyo cobro está vencido y aún no se ha avisado.
-- La devuelve la capa de aplicación para crear el mensaje y enviar el correo;
-- aquí sólo se decide QUIÉNES, no se envía nada.
CREATE OR REPLACE FUNCTION public.mantenimientos_por_avisar()
RETURNS TABLE (
  admin_id uuid,
  nombre text,
  email text,
  monto numeric,
  proximo_pago date,
  venia_de_prueba boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.admin_id,
         coalesce(p.full_name, p.username, p.email) AS nombre,
         p.email,
         m.monto,
         m.proximo_pago,
         -- Un vencimiento cuyo cobro nunca se pagó y que arrastra fecha de fin
         -- viene de un mes de prueba: el mensaje al administrador cambia.
         (m.ultimo_pago IS NULL) AS venia_de_prueba
    FROM public.admin_maintenance m
    JOIN public.profiles p ON p.id = m.admin_id
   WHERE m.estado = 'VENCIDO'
     AND p.is_active = true
     -- Sin avisar nunca, o avisado antes del vencimiento actual.
     AND (m.aviso_vencimiento_en IS NULL
          OR m.aviso_vencimiento_en::date < m.proximo_pago);
$$;

CREATE OR REPLACE FUNCTION public.marcar_aviso_mantenimiento(p_admin_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.admin_maintenance
     SET aviso_vencimiento_en = now(), updated_at = now()
   WHERE admin_id = p_admin_id;
$$;

REVOKE ALL ON FUNCTION public.mantenimientos_por_avisar() FROM public, anon;
REVOKE ALL ON FUNCTION public.marcar_aviso_mantenimiento(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mantenimientos_por_avisar() TO service_role;
GRANT EXECUTE ON FUNCTION public.marcar_aviso_mantenimiento(uuid) TO service_role;

COMMIT;
