-- =============================================================================
-- Comprobación del modelo corregido: el MEGAADMINISTRADOR no ve datos de negocio.
--
-- Se ejecuta contra las CUENTAS REALES ya existentes, suplantando su JWT con
-- set_config. Es de SÓLO LECTURA sobre los datos y termina en ROLLBACK.
--
-- Lo que verifica:
--   • El megaadministrador ve 0 clientes, 0 préstamos, 0 abonos, 0 registros.
--   • Sigue viendo lo que SÍ le corresponde: perfiles, mantenimiento,
--     mensajes y auditoría.
--   • El administrador titular ve su cartera completa.
--   • El subusuario ve la cartera de su administrador.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _r (
  n serial, prueba text, esperado text, obtenido text, veredicto text
) ON COMMIT DROP;
GRANT ALL ON _r TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE _r_n_seq TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.chk(p text, esp anyelement, obt anyelement)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _r (prueba, esperado, obtenido, veredicto)
  VALUES (p, esp::text, obt::text,
    CASE WHEN esp::text IS NOT DISTINCT FROM obt::text
         THEN 'PASA' ELSE '*** FALLA ***' END);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.como(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.sistema()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', '', true);
END; $$;

DO $$
DECLARE
  id_mega uuid;
  id_adm  uuid;
  id_sub  uuid;
  n int;
  b boolean;
BEGIN
  PERFORM pg_temp.sistema();

  SELECT id INTO id_mega FROM public.profiles WHERE role = 'super_admin' LIMIT 1;
  SELECT id INTO id_adm  FROM public.profiles WHERE role = 'admin'       LIMIT 1;
  SELECT id INTO id_sub  FROM public.profiles WHERE role = 'sub_user'    LIMIT 1;

  -- ═══════════ MEGAADMINISTRADOR: cero datos operativos ═══════════
  PERFORM pg_temp.como(id_mega);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.chk('Megaadmin NO ve clientes', 0, n);

  SELECT count(*) INTO n FROM public.prestamos;
  PERFORM pg_temp.chk('Megaadmin NO ve prestamos', 0, n);

  SELECT count(*) INTO n FROM public.abonos;
  PERFORM pg_temp.chk('Megaadmin NO ve abonos', 0, n);

  SELECT count(*) INTO n FROM public.reganches;
  PERFORM pg_temp.chk('Megaadmin NO ve reganches', 0, n);

  SELECT count(*) INTO n FROM public.intereses_atrasados;
  PERFORM pg_temp.chk('Megaadmin NO ve intereses', 0, n);

  SELECT count(*) INTO n FROM public.empresas;
  PERFORM pg_temp.chk('Megaadmin NO ve empresas', 0, n);

  SELECT count(*) INTO n FROM public.representantes;
  PERFORM pg_temp.chk('Megaadmin NO ve representantes', 0, n);

  SELECT count(*) INTO n FROM public.gestion_cobranza;
  PERFORM pg_temp.chk('Megaadmin NO ve gestion de cobranza', 0, n);

  SELECT count(*) INTO n FROM public.notificaciones;
  PERFORM pg_temp.chk('Megaadmin NO ve notificaciones', 0, n);

  -- Tampoco puede CREAR cartera.
  BEGIN
    INSERT INTO public.empresas (nombre) VALUES ('Intento del megaadmin');
    PERFORM pg_temp.chk('Megaadmin NO puede crear empresas', 'rechazado'::text, 'ACEPTADO'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Megaadmin NO puede crear empresas', 'rechazado'::text, 'rechazado'::text);
  END;

  -- Ni recibir permisos de negocio por la puerta de atrás.
  SELECT public.has_permission('clientes.ver') INTO b;
  PERFORM pg_temp.chk('Megaadmin sin permiso clientes.ver', false, b);
  SELECT public.has_permission('prestamos.eliminar') INTO b;
  PERFORM pg_temp.chk('Megaadmin sin permiso prestamos.eliminar', false, b);

  -- ═══════════ MEGAADMINISTRADOR: sí ve lo de plataforma ═══════════
  SELECT count(*) INTO n FROM public.profiles;
  PERFORM pg_temp.chk('Megaadmin SI ve los perfiles', 3, n);

  SELECT count(*) INTO n FROM public.admin_maintenance;
  PERFORM pg_temp.chk('Megaadmin SI ve el mantenimiento', 1, n);

  SELECT public.has_permission('administradores.crear') INTO b;
  PERFORM pg_temp.chk('Megaadmin SI puede crear administradores', true, b);

  SELECT public.has_permission('administradores.mantenimiento') INTO b;
  PERFORM pg_temp.chk('Megaadmin SI gestiona mantenimiento', true, b);

  -- ═══════════ ADMINISTRADOR TITULAR: ve su cartera ═══════════
  PERFORM pg_temp.como(id_adm);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.chk('Administrador SI ve sus clientes', 10, n);

  SELECT count(*) INTO n FROM public.prestamos;
  PERFORM pg_temp.chk('Administrador SI ve sus prestamos', 7, n);

  SELECT count(*) INTO n FROM public.abonos;
  PERFORM pg_temp.chk('Administrador SI ve sus abonos', 22, n);

  SELECT public.has_permission('administradores.crear') INTO b;
  PERFORM pg_temp.chk('Administrador NO gestiona la plataforma', false, b);

  -- ═══════════ SUBUSUARIO: ve la cartera de su administrador ═══════════
  PERFORM pg_temp.como(id_sub);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.chk('Subusuario SI ve los clientes de su admin', 10, n);

  SELECT public.has_permission('administradores.crear') INTO b;
  PERFORM pg_temp.chk('Subusuario NO gestiona la plataforma', false, b);

  PERFORM pg_temp.sistema();
END $$;

SELECT n AS "#", prueba, esperado, obtenido, veredicto FROM _r ORDER BY n;

ROLLBACK;
