-- ============================================================
-- Migration 004: Enable RLS on all business tables
-- Policy: any active authenticated user (admin or super_admin) can
-- read and write all business data.
-- This preserves current behavior while making RLS explicit.
-- ============================================================

BEGIN;

-- Helper macro: the current user must be an active admin/super_admin.
-- Re-uses is_admin() SECURITY DEFINER function from migration 002.

-- ── empresas ───────────────────────────────────────────────
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_all_admins" ON public.empresas;
CREATE POLICY "empresas_all_admins"
  ON public.empresas FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── representantes ─────────────────────────────────────────
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "representantes_all_admins" ON public.representantes;
CREATE POLICY "representantes_all_admins"
  ON public.representantes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── clientes ───────────────────────────────────────────────
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_all_admins" ON public.clientes;
CREATE POLICY "clientes_all_admins"
  ON public.clientes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── prestamos ──────────────────────────────────────────────
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prestamos_all_admins" ON public.prestamos;
CREATE POLICY "prestamos_all_admins"
  ON public.prestamos FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── abonos ─────────────────────────────────────────────────
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "abonos_all_admins" ON public.abonos;
CREATE POLICY "abonos_all_admins"
  ON public.abonos FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── reganches ──────────────────────────────────────────────
ALTER TABLE public.reganches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reganches_all_admins" ON public.reganches;
CREATE POLICY "reganches_all_admins"
  ON public.reganches FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── intereses_atrasados ────────────────────────────────────
ALTER TABLE public.intereses_atrasados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intereses_atrasados_all_admins" ON public.intereses_atrasados;
CREATE POLICY "intereses_atrasados_all_admins"
  ON public.intereses_atrasados FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── gestion_cobranza ───────────────────────────────────────
ALTER TABLE public.gestion_cobranza ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gestion_cobranza_all_admins" ON public.gestion_cobranza;
CREATE POLICY "gestion_cobranza_all_admins"
  ON public.gestion_cobranza FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── notificaciones ─────────────────────────────────────────
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificaciones_all_admins" ON public.notificaciones;
CREATE POLICY "notificaciones_all_admins"
  ON public.notificaciones FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role retains full access (used by admin API and cron jobs)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

COMMIT;
