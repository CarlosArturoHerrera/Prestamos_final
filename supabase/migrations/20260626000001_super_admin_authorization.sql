-- ============================================================
-- Migration: Super Admin Authorization Model
--
-- Verifica y re-afirma el modelo de autorización:
--
--   super_admin → UPDATE sobre cualquier fila de profiles,
--                 incluyendo la suya propia.
--   admin       → Sin permisos de UPDATE sobre profiles,
--                 tampoco sobre su propia fila.
--
-- Esta migración:
--   1. Actualiza is_super_admin() para mayor claridad.
--   2. Agrega is_admin_only() — útil para pruebas y auditoría.
--   3. Recrea las políticas RLS de profiles con documentación.
--   4. Agrega trigger prevent_self_role_demotion: el super_admin
--      no puede cambiar su propio role via cliente autenticado.
--
-- Nota: las rutas de API usan service_role (bypass de RLS).
-- El RLS es la segunda línea de defensa para clientes directos.
-- ============================================================

BEGIN;

-- ── 1. Helper functions ────────────────────────────────────────────────────

-- is_super_admin(): TRUE cuando el usuario actual es super_admin activo.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- is_admin_only(): TRUE cuando el usuario actual es admin (no super_admin).
CREATE OR REPLACE FUNCTION public.is_admin_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- get_current_role(): devuelve el rol textual del usuario actual.
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ── 2. Policies on profiles ────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete"       ON public.profiles;

-- SELECT: cada usuario puede ver su propio perfil.
--         super_admin puede ver todos los perfiles.
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
  );

-- INSERT: solo la fila propia (trigger fallback).
--         service_role bypassea RLS en la creación de usuarios.
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: SOLO super_admin puede hacer UPDATE sobre cualquier fila,
--         incluyendo la suya propia.
--         admin recibe FALSE de is_super_admin() → no puede UPDATE
--         ninguna fila, tampoco la suya.
--
-- USING (is_super_admin()):
--   Filtra qué filas son elegibles como objetivo del UPDATE.
--   super_admin → TRUE → puede apuntar a cualquier fila.
--   admin       → FALSE → ninguna fila es elegible.
--
-- WITH CHECK (is_super_admin()):
--   Evalúa los valores NUEVOS tras el UPDATE.
--   Si super_admin cambia su propio role a 'admin', is_super_admin()
--   devuelve FALSE sobre la fila ya modificada → el cambio es rechazado.
--   Esto previene que el super_admin se auto-degrade accidentalmente
--   vía cliente directo (no aplica a service_role).
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING   (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- DELETE: super_admin puede eliminar perfiles de admin.
--         La eliminación en cascada desde auth.users usa service_role.
CREATE POLICY "profiles_delete"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Acceso irrestricto para service_role (bypass implícito, aquí explícito)
GRANT ALL ON public.profiles TO service_role;

-- ── 3. Trigger: prevent_self_role_demotion ─────────────────────────────────
-- Capa adicional de defensa: bloquea que un super_admin cambie su propio
-- role a través del cliente autenticado (no service_role).
-- La aplicación no expone este vector, pero el trigger lo cierra a nivel DB.

CREATE OR REPLACE FUNCTION public.prevent_self_role_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actúa cuando el role cambia y el usuario modifica su propia fila
  IF NEW.id = auth.uid()
     AND NEW.role IS DISTINCT FROM OLD.role
     AND OLD.role = 'super_admin'
  THEN
    RAISE EXCEPTION
      'super_admin cannot demote their own role (use service_role for this operation)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_demotion ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_demotion
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_demotion();

COMMIT;
