-- ============================================================
-- Migration 001: Update profiles table to super_admin / admin
-- Adds: is_active, email columns; migrates existing roles.
-- Safe to run multiple times (idempotent via IF NOT EXISTS / DO $$).
-- ============================================================

BEGIN;

-- 1. Drop old CHECK constraint so we can change allowed values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add is_active column (default true = active)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Add email column (cached from auth.users for easy queries / joins)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 4. Migrate existing roles
--    ADMIN    → admin
--    OPERADOR → admin  (OPERADOR is removed from the new role system)
UPDATE public.profiles
  SET role = 'admin'
  WHERE role IN ('ADMIN', 'OPERADOR');

-- 5. New default + new CHECK constraint
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'admin';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin'));

-- 6. Replace trigger function to use new role and store email / full_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email, full_name, is_active)
  VALUES (
    new.id,
    'admin',
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      NULL
    ),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 7. Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Ensure updated_at trigger on profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
