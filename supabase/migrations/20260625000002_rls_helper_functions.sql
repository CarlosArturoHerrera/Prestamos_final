-- ============================================================
-- Migration 002: RLS helper functions
-- These functions are SECURITY DEFINER so they bypass RLS when
-- reading profiles, preventing infinite recursion in policies.
-- ============================================================

BEGIN;

-- Returns the role of the currently authenticated user.
-- STABLE + SECURITY DEFINER: Postgres caches per-statement and
-- the function bypasses RLS when querying profiles itself.
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

-- Returns TRUE when the calling user is the super_admin.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- Returns TRUE when the calling user is an admin (any role, active).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
  );
$$;

-- Disable an admin account (only super_admin should call this via app logic).
-- Returns TRUE on success.
CREATE OR REPLACE FUNCTION public.disable_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: super_admin required';
  END IF;

  -- Cannot disable yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot disable your own account';
  END IF;

  UPDATE public.profiles
    SET is_active = false, updated_at = now()
    WHERE id = target_user_id
      AND role != 'super_admin';   -- cannot disable another super_admin

  RETURN FOUND;
END;
$$;

-- Re-enable an admin account.
CREATE OR REPLACE FUNCTION public.enable_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: super_admin required';
  END IF;

  UPDATE public.profiles
    SET is_active = true, updated_at = now()
    WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

COMMIT;
