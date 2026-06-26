-- ============================================================
-- Migration 003: Enable RLS on profiles with role-based policies
-- Depends on: Migration 002 (helper functions)
-- ============================================================

BEGIN;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- SELECT: users can see their own profile; super_admin can see all.
-- Two conditions OR'd together — Postgres applies any matching policy.
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
  );

-- INSERT: each user can only insert their own profile row (trigger fallback).
-- Service role (admin API) bypasses RLS entirely.
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: super_admin can update any profile (role, is_active, full_name, email).
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- DELETE: super_admin can delete any profile (except service_role does it during auth.users cascade).
CREATE POLICY "profiles_delete"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Grant service_role unrestricted access (bypass RLS by default, but explicit grant for clarity)
GRANT ALL ON public.profiles TO service_role;

COMMIT;
