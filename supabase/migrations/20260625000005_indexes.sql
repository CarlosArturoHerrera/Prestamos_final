-- ============================================================
-- Migration 005: Indexes for performance
-- ============================================================

BEGIN;

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active   ON public.profiles (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email       ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at  ON public.profiles (created_at DESC);

-- prestamos (frequently queried fields)
CREATE INDEX IF NOT EXISTS idx_prestamos_estado     ON public.prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_id ON public.prestamos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha_prox ON public.prestamos (fecha_proximo_vencimiento);

-- abonos
CREATE INDEX IF NOT EXISTS idx_abonos_prestamo_id  ON public.abonos (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_abonos_fecha        ON public.abonos (fecha_abono DESC);

-- gestion_cobranza
CREATE INDEX IF NOT EXISTS idx_gestion_cobranza_cliente  ON public.gestion_cobranza (cliente_id);
CREATE INDEX IF NOT EXISTS idx_gestion_cobranza_prestamo ON public.gestion_cobranza (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_gestion_cobranza_creado_por ON public.gestion_cobranza (creado_por);

COMMIT;
