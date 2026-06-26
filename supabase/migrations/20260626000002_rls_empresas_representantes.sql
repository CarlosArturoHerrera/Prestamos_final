-- ============================================================
-- Migration: Enable RLS on public.empresas + public.representantes
--
-- Context
-- -------
-- The Supabase Security Advisor flags these two tables as
-- "RLS Disabled in Public". Migration 004 (rls_business_tables)
-- covered them, but that migration references public.gestion_cobranza
-- inside the same BEGIN…COMMIT block. If gestion_cobranza does not
-- exist at run time the entire block fails, leaving empresas and
-- representantes unprotected.
--
-- This migration is:
--   • Self-contained  — recreates is_admin() inline; no dependency
--                        on migration 002 being already applied.
--   • Idempotent      — safe to run multiple times; DROP … IF EXISTS
--                        before every CREATE.
--   • Minimal         — touches only the two flagged tables so the
--                        risk surface is small.
--
-- Access model
-- ------------
--   authenticated + (role = 'admin' OR 'super_admin') + is_active
--       → full read/write access
--   authenticated + any other role or inactive account
--       → no rows visible (RLS returns empty set)
--   anon
--       → GRANT revoked + no policy → hard deny at two levels
--   service_role
--       → bypasses RLS (used by admin API routes and cron jobs)
--
-- All application API routes go through createSupabaseServerClient()
-- (cookie-based JWT). auth.uid() resolves to the signed-in user.
-- is_admin() is SECURITY DEFINER so it reads profiles without
-- triggering a recursive RLS check on profiles itself.
-- ============================================================

BEGIN;

-- ── 1. Helper function ──────────────────────────────────────────────────────
-- is_admin(): TRUE when the calling user is an active admin or super_admin.
-- Marked STABLE so Postgres caches the result within a single statement.
-- SECURITY DEFINER + fixed search_path prevents search_path injection.
-- CREATE OR REPLACE is safe even if migration 002 already created it.
CREATE OR REPLACE FUNCTION public.is_admin()
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
      AND role IN ('super_admin', 'admin')
      AND is_active = true
  );
$$;

-- ── 2. public.empresas ─────────────────────────────────────────────────────
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Single FOR ALL policy: avoids four separate policies while keeping
-- the same effective behaviour — any active admin can SELECT/INSERT/
-- UPDATE/DELETE any row.
DROP POLICY IF EXISTS "empresas_all_admins" ON public.empresas;
CREATE POLICY "empresas_all_admins"
  ON public.empresas
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 3. public.representantes ───────────────────────────────────────────────
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "representantes_all_admins" ON public.representantes;
CREATE POLICY "representantes_all_admins"
  ON public.representantes
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. Explicit grants ─────────────────────────────────────────────────────
-- service_role already bypasses RLS by default; the GRANT below is
-- explicit documentation of intent rather than functional necessity.
GRANT ALL ON public.empresas       TO service_role;
GRANT ALL ON public.representantes TO service_role;

-- Authenticated users need SELECT/INSERT/UPDATE/DELETE through the
-- policies defined above.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representantes TO authenticated;

-- ── 5. Revoke anon access ──────────────────────────────────────────────────
-- The original microfinanzas migration granted ALL ON ALL TABLES to anon.
-- Business data must never be accessible to unauthenticated clients,
-- even if an operator accidentally drops an RLS policy.
-- Belt-and-suspenders: revoke the GRANT entirely.
REVOKE ALL ON public.empresas       FROM anon;
REVOKE ALL ON public.representantes FROM anon;

COMMIT;
