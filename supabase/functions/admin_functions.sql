-- ============================================================
-- PostgreSQL helper functions for role management
-- Reference copy — canonical version is migration 002.
-- ============================================================

-- Returns the role text of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns true if the current user is an active super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

-- Returns true if the current user is any active admin (super_admin or admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin') AND is_active = true
  );
$$;

-- Deactivate an admin account (super_admin only)
CREATE OR REPLACE FUNCTION public.disable_admin(target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: super_admin required';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot disable your own account';
  END IF;
  UPDATE public.profiles
    SET is_active = false, updated_at = now()
    WHERE id = target_user_id AND role != 'super_admin';
  RETURN FOUND;
END;
$$;

-- Reactivate an admin account (super_admin only)
CREATE OR REPLACE FUNCTION public.enable_admin(target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
