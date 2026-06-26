-- ============================================================
-- RLS Policies: profiles table
-- Reference copy — the canonical version is migration 003.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own profile or super_admin
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin());

-- INSERT: own row only (trigger fallback; service_role bypasses RLS)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: super_admin only
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- DELETE: super_admin only
CREATE POLICY "profiles_delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin());
