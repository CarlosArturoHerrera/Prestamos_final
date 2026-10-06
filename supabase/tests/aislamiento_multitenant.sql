-- =============================================================================
-- Pruebas de aislamiento multi-tenant (§31, §32, §33)
--
-- Cómo ejecutarlo
-- ---------------
-- Supabase Dashboard → SQL Editor → pega este archivo entero y ejecútalo.
-- Al final imprime una tabla con una fila por comprobación y PASA / FALLA.
--
-- Qué hace
-- --------
-- Crea DOS administradores de prueba con su propia cartera y un subusuario
-- cada uno, y verifica desde la propia base de datos —suplantando el JWT de
-- cada usuario con set_config('request.jwt.claims')— que:
--
--   • El administrador A no ve absolutamente nada de B, y viceversa.
--   • Un SELECT directo por id al recurso de otro (IDOR) devuelve 0 filas.
--   • Los subusuarios sólo ven la organización de su administrador.
--   • Los permisos granulares bloquean lo que no se ha concedido.
--   • Deshabilitar un administrador corta también a sus subusuarios.
--   • El megaadministrador sigue viéndolo todo.
--
-- IMPORTANTE
-- ----------
-- TODO corre dentro de una transacción que termina en ROLLBACK: no queda
-- NINGÚN dato de prueba en la base, y no se toca ni un registro real.
-- Tampoco se ejecuta ningún cálculo financiero: sólo se insertan filas y se
-- comprueba quién las ve.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _resultados (
  n          serial,
  prueba     text,
  esperado   text,
  obtenido   text,
  veredicto  text
) ON COMMIT DROP;

-- Al suplantar usuarios el rol pasa a `authenticated`, que por defecto no
-- puede escribir en una tabla temporal creada por el propietario de la
-- sesion. Se le concede aqui: la tabla desaparece con el COMMIT/ROLLBACK.
GRANT ALL ON _resultados TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE _resultados_n_seq TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.comprobar(
  p_prueba text, p_esperado anyelement, p_obtenido anyelement
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _resultados (prueba, esperado, obtenido, veredicto)
  VALUES (
    p_prueba,
    p_esperado::text,
    p_obtenido::text,
    CASE WHEN p_esperado::text IS NOT DISTINCT FROM p_obtenido::text
         THEN 'PASA' ELSE '*** FALLA ***' END
  );
END;
$$;

-- Suplanta a un usuario: a partir de aquí auth.uid() devuelve p_id y las
-- policies RLS se evalúan como si fuese él quien consulta.
CREATE OR REPLACE FUNCTION pg_temp.actuar_como(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- Vuelve al rol propietario (sin RLS) para preparar datos.
CREATE OR REPLACE FUNCTION pg_temp.actuar_como_sistema()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- 'none' equivale a RESET ROLE: vuelve al usuario de la sesión. Poner
  -- 'postgres' fallaría, porque `authenticated` no es miembro de ese rol.
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

DO $$
DECLARE
  id_mega  uuid := gen_random_uuid();
  id_a     uuid := gen_random_uuid();
  id_b     uuid := gen_random_uuid();
  id_a1    uuid := gen_random_uuid();
  id_a2    uuid := gen_random_uuid();
  id_b1    uuid := gen_random_uuid();

  emp_a int; emp_b int;
  rep_a int; rep_b int;
  cli_a int; cli_b int;
  pre_a int; pre_b int;
  n int;
  ok boolean;
BEGIN
  PERFORM pg_temp.actuar_como_sistema();

  -- ── Jerarquía de prueba ───────────────────────────────────────────────
  -- Se insertan directamente en profiles. En producción cada perfil cuelga de
  -- un auth.users, pero para probar RLS basta la fila de profiles: auth.uid()
  -- se suplanta con set_config y la FK a auth.users se evita porque estas
  -- filas se eliminan con el ROLLBACK final.
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  INSERT INTO public.profiles (id, role, admin_id, email, username, first_name, last_name, is_active) VALUES
    (id_mega, 'super_admin', NULL, 'mega@test.local',  'test_mega', 'Mega', 'Admin', true),
    (id_a,    'admin',       NULL, 'adma@test.local',  'test_adma', 'Admin', 'A',    true),
    (id_b,    'admin',       NULL, 'admb@test.local',  'test_admb', 'Admin', 'B',    true),
    (id_a1,   'sub_user',    id_a, 'suba1@test.local', 'test_a1',   'Sub',   'A1',   true),
    (id_a2,   'sub_user',    id_a, 'suba2@test.local', 'test_a2',   'Sub',   'A2',   true),
    (id_b1,   'sub_user',    id_b, 'subb1@test.local', 'test_b1',   'Sub',   'B1',   true);

  -- Permisos: A1 sólo lee clientes; A2 lee y crea. B1 lee clientes y préstamos.
  INSERT INTO public.user_permissions (user_id, permission_code) VALUES
    (id_a1, 'clientes.ver'),
    (id_a2, 'clientes.ver'), (id_a2, 'clientes.crear'),
    (id_b1, 'clientes.ver'), (id_b1, 'prestamos.ver');

  -- ── Cartera de A ──────────────────────────────────────────────────────
  INSERT INTO public.empresas (nombre, admin_id) VALUES ('Empresa A', id_a) RETURNING id INTO emp_a;
  INSERT INTO public.representantes (nombre, apellido, telefono, email, admin_id)
    VALUES ('Rep', 'A', '8090000001', 'repa@test.local', id_a) RETURNING id INTO rep_a;
  INSERT INTO public.clientes (nombre, apellido, cedula, ubicacion, telefono, representante_id, empresa_id, admin_id)
    VALUES ('Cliente', 'A', 'TESTA-001', 'Santiago', '8090000011', rep_a, emp_a, id_a) RETURNING id INTO cli_a;
  INSERT INTO public.prestamos (cliente_id, monto, tasa_interes, plazo, tipo_plazo, fecha_inicio,
                                fecha_vencimiento, fecha_proximo_vencimiento, capital_pendiente)
    VALUES (cli_a, 10000, 10, 1, 'MENSUAL', current_date, current_date + 30, current_date + 30, 10000)
    RETURNING id INTO pre_a;

  -- ── Cartera de B ──────────────────────────────────────────────────────
  INSERT INTO public.empresas (nombre, admin_id) VALUES ('Empresa B', id_b) RETURNING id INTO emp_b;
  INSERT INTO public.representantes (nombre, apellido, telefono, email, admin_id)
    VALUES ('Rep', 'B', '8090000002', 'repb@test.local', id_b) RETURNING id INTO rep_b;
  INSERT INTO public.clientes (nombre, apellido, cedula, ubicacion, telefono, representante_id, empresa_id, admin_id)
    VALUES ('Cliente', 'B', 'TESTB-001', 'Santo Domingo', '8090000022', rep_b, emp_b, id_b) RETURNING id INTO cli_b;
  INSERT INTO public.prestamos (cliente_id, monto, tasa_interes, plazo, tipo_plazo, fecha_inicio,
                                fecha_vencimiento, fecha_proximo_vencimiento, capital_pendiente)
    VALUES (cli_b, 20000, 10, 1, 'MENSUAL', current_date, current_date + 30, current_date + 30, 20000)
    RETURNING id INTO pre_b;

  INSERT INTO public.abonos (prestamo_id, fecha_abono, monto_capital_debitado, interes_cobrado,
                             total_pagado, saldo_capital_restante)
    VALUES (pre_b, current_date, 0, 100, 100, 20000);

  -- ═══════════════════ §31 — Aislamiento entre administradores ═══════════

  PERFORM pg_temp.actuar_como(id_a);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('A ve sólo SUS clientes', 1, n);

  SELECT count(*) INTO n FROM public.clientes WHERE id = cli_b;
  PERFORM pg_temp.comprobar('IDOR: A pide el cliente de B por id', 0, n);

  SELECT count(*) INTO n FROM public.prestamos WHERE id = pre_b;
  PERFORM pg_temp.comprobar('IDOR: A pide el préstamo de B por id', 0, n);

  SELECT count(*) INTO n FROM public.abonos;
  PERFORM pg_temp.comprobar('A no ve los abonos de B (herencia por préstamo)', 0, n);

  SELECT count(*) INTO n FROM public.empresas;
  PERFORM pg_temp.comprobar('A ve sólo SUS empresas', 1, n);

  SELECT count(*) INTO n FROM public.representantes;
  PERFORM pg_temp.comprobar('A ve sólo SUS representantes', 1, n);

  PERFORM pg_temp.actuar_como(id_b);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('B ve sólo SUS clientes', 1, n);

  SELECT count(*) INTO n FROM public.clientes WHERE id = cli_a;
  PERFORM pg_temp.comprobar('IDOR: B pide el cliente de A por id', 0, n);

  SELECT count(*) INTO n FROM public.abonos;
  PERFORM pg_temp.comprobar('B sí ve SUS abonos', 1, n);

  -- Escritura cruzada: B intenta reescribir un cliente de A.
  UPDATE public.clientes SET ubicacion = 'HACKEADO' WHERE id = cli_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.comprobar('B no puede modificar un cliente de A', 0, n);

  -- Y a robárselo cambiándole el propietario.
  UPDATE public.clientes SET admin_id = id_b WHERE id = cli_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.comprobar('B no puede apropiarse del cliente de A', 0, n);

  -- Coser un cliente propio a una empresa ajena.
  BEGIN
    INSERT INTO public.clientes (nombre, apellido, cedula, ubicacion, telefono,
                                 representante_id, empresa_id)
    VALUES ('Fuga', 'Test', 'TESTX-001', 'X', '8090000099', rep_a, emp_a);
    PERFORM pg_temp.comprobar('B no puede usar la empresa/representante de A', 'rechazado'::text, 'ACEPTADO'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.comprobar('B no puede usar la empresa/representante de A', 'rechazado'::text, 'rechazado'::text);
  END;

  -- ═══════════════════ §32 — Subusuarios ═════════════════════════════════

  PERFORM pg_temp.actuar_como(id_a1);

  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('A1 ve los clientes de A', 1, n);

  SELECT count(*) INTO n FROM public.clientes WHERE id = cli_b;
  PERFORM pg_temp.comprobar('A1 no ve los clientes de B', 0, n);

  -- A1 NO tiene prestamos.ver.
  SELECT count(*) INTO n FROM public.prestamos;
  PERFORM pg_temp.comprobar('A1 sin permiso prestamos.ver → 0 préstamos', 0, n);

  -- A1 NO tiene clientes.crear.
  BEGIN
    INSERT INTO public.clientes (nombre, apellido, cedula, ubicacion, telefono,
                                 representante_id, empresa_id)
    VALUES ('NoDebe', 'Crear', 'TESTA-999', 'X', '8090000088', rep_a, emp_a);
    PERFORM pg_temp.comprobar('A1 sin permiso clientes.crear', 'rechazado'::text, 'ACEPTADO'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.comprobar('A1 sin permiso clientes.crear', 'rechazado'::text, 'rechazado'::text);
  END;

  PERFORM pg_temp.actuar_como(id_a2);

  -- A2 SÍ tiene clientes.crear: debe funcionar y quedar estampado con el
  -- tenant de A aunque no lo envíe.
  INSERT INTO public.clientes (nombre, apellido, cedula, ubicacion, telefono,
                               representante_id, empresa_id)
  VALUES ('Creado', 'PorA2', 'TESTA-002', 'Santiago', '8090000077', rep_a, emp_a);

  PERFORM pg_temp.actuar_como_sistema();
  SELECT admin_id = id_a INTO ok FROM public.clientes WHERE cedula = 'TESTA-002';
  PERFORM pg_temp.comprobar('Cliente creado por A2 queda en la organización de A', true, ok);

  PERFORM pg_temp.actuar_como(id_b1);
  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('B1 ve sólo los clientes de B', 1, n);
  SELECT count(*) INTO n FROM public.prestamos;
  PERFORM pg_temp.comprobar('B1 con prestamos.ver ve los préstamos de B', 1, n);

  -- ═══════════════ §11 — Deshabilitar arrastra a los subusuarios ═════════

  PERFORM pg_temp.actuar_como_sistema();
  UPDATE public.profiles SET is_active = false WHERE id = id_a;

  PERFORM pg_temp.actuar_como(id_a1);
  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('A deshabilitado → A1 pierde el acceso', 0, n);

  PERFORM pg_temp.actuar_como(id_a);
  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('A deshabilitado → A no ve nada', 0, n);

  -- Los datos siguen intactos: nada se borró, sólo dejó de ser visible.
  PERFORM pg_temp.actuar_como_sistema();
  SELECT count(*) INTO n FROM public.clientes WHERE admin_id = id_a;
  PERFORM pg_temp.comprobar('Los datos de A siguen existiendo', 2, n);

  -- §12 — Reactivar lo devuelve todo.
  UPDATE public.profiles SET is_active = true WHERE id = id_a;
  PERFORM pg_temp.actuar_como(id_a1);
  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('A reactivado → A1 recupera el acceso', 2, n);

  -- ═══════════════════ §33 — Megaadministrador ═══════════════════════════

  PERFORM pg_temp.actuar_como(id_mega);

  -- MODELO CORREGIDO: el megaadministrador administra CUENTAS, no cartera.
  -- No debe ver ni un cliente, ni un prestamo, ni un abono de nadie.
  SELECT count(*) INTO n FROM public.clientes;
  PERFORM pg_temp.comprobar('Megaadmin NO ve ningun cliente', 0, n);

  SELECT count(*) INTO n FROM public.prestamos;
  PERFORM pg_temp.comprobar('Megaadmin NO ve ningun prestamo', 0, n);

  SELECT count(*) INTO n FROM public.abonos;
  PERFORM pg_temp.comprobar('Megaadmin NO ve ningun abono', 0, n);

  -- Pero SI ve lo que le corresponde: las cuentas de la plataforma.
  SELECT count(*) INTO n FROM public.profiles WHERE username LIKE 'test_%';
  PERFORM pg_temp.comprobar('Megaadmin SI ve todos los perfiles', 6, n);

  -- Y no puede concederse permisos de negocio por ninguna via.
  SELECT public.has_permission('clientes.ver') INTO ok;
  PERFORM pg_temp.comprobar('Megaadmin sin permiso clientes.ver', false, ok);

  SELECT public.has_permission('administradores.crear') INTO ok;
  PERFORM pg_temp.comprobar('Megaadmin SI con permiso administradores.crear', true, ok);

  -- ═══════════════ §29 — No se puede escalar privilegios ═════════════════

  PERFORM pg_temp.actuar_como(id_a1);
  -- Se comprueba el RESULTADO, no el mecanismo. El intento puede fallar de
  -- dos formas igual de validas: con excepcion del trigger
  -- prevent_hierarchy_escalation, o sin tocar ninguna fila porque la policy
  -- profiles_update ya la filtro. Lo que importa es que el rol NO cambie.
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = id_a1;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  PERFORM pg_temp.actuar_como_sistema();
  SELECT role = 'sub_user' INTO ok FROM public.profiles WHERE id = id_a1;
  PERFORM pg_temp.comprobar(
    'A1 sigue siendo sub_user tras intentar ascenderse', true, ok);
  PERFORM pg_temp.actuar_como(id_a1);

  BEGIN
    INSERT INTO public.user_permissions (user_id, permission_code)
    VALUES (id_a1, 'prestamos.eliminar');
    PERFORM pg_temp.comprobar('A1 no puede concederse permisos', 'rechazado'::text, 'ACEPTADO'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.comprobar('A1 no puede concederse permisos', 'rechazado'::text, 'rechazado'::text);
  END;

  -- Un subusuario de A intentando cambiar de organización.
  PERFORM pg_temp.actuar_como(id_b);
  UPDATE public.profiles SET admin_id = id_b WHERE id = id_a1;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.comprobar('B no puede robar el subusuario A1', 0, n);

  PERFORM pg_temp.actuar_como_sistema();
END $$;

-- ── Resultados ──────────────────────────────────────────────────────────────
SELECT n AS "#", prueba, esperado, obtenido, veredicto FROM _resultados ORDER BY n;

SELECT
  count(*) FILTER (WHERE veredicto = 'PASA')            AS pasan,
  count(*) FILTER (WHERE veredicto <> 'PASA')           AS fallan,
  CASE WHEN count(*) FILTER (WHERE veredicto <> 'PASA') = 0
       THEN '✅ AISLAMIENTO CORRECTO'
       ELSE '❌ HAY FUGAS — revisa las filas marcadas'
  END AS resultado
FROM _resultados;

-- Nada de lo anterior se conserva: se revierte TODO, incluida la eliminación
-- temporal de la FK profiles_id_fkey.
ROLLBACK;
