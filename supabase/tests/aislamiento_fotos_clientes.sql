-- =============================================================================
-- Aislamiento de las fotografías de clientes entre administradores.
--
-- Comprueba que las policies del bucket `clientes-fotos` y el trigger de
-- `foto_path` impiden que un administrador alcance la imagen de otro, incluso
-- conociendo la ruta exacta.
--
-- Todo dentro de una transacción que termina en ROLLBACK.
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
  id_mega uuid; id_a uuid; id_b uuid;
  emp_a int; rep_a int; cli_a int;
  emp_b int; rep_b int; cli_b int;
  ruta_a text; ruta_b text;
  n int; e text;
BEGIN
  PERFORM pg_temp.sistema();
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  id_mega := gen_random_uuid();
  id_a := gen_random_uuid();
  id_b := gen_random_uuid();

  INSERT INTO public.profiles (id, role, admin_id, email, username, is_active) VALUES
    (id_mega,'super_admin',NULL,'m@t.local','t_mega',true),
    (id_a,   'admin',      NULL,'a@t.local','t_a',   true),
    (id_b,   'admin',      NULL,'b@t.local','t_b',   true);

  -- Cartera de A, con foto
  INSERT INTO public.empresas (nombre, admin_id) VALUES ('EmpA', id_a) RETURNING id INTO emp_a;
  INSERT INTO public.representantes (nombre,apellido,telefono,email,admin_id)
    VALUES ('R','A','8090000001','ra@t.local',id_a) RETURNING id INTO rep_a;
  INSERT INTO public.clientes (nombre,apellido,apodo,cedula,ubicacion,telefono,representante_id,empresa_id,admin_id)
    VALUES ('Juan','Pérez','El Moreno','TA-1','X','8090000011',rep_a,emp_a,id_a) RETURNING id INTO cli_a;
  ruta_a := id_a::text || '/' || cli_a::text || '/foto.webp';
  UPDATE public.clientes SET foto_path = ruta_a WHERE id = cli_a;

  -- Cartera de B, con foto
  INSERT INTO public.empresas (nombre, admin_id) VALUES ('EmpB', id_b) RETURNING id INTO emp_b;
  INSERT INTO public.representantes (nombre,apellido,telefono,email,admin_id)
    VALUES ('R','B','8090000002','rb@t.local',id_b) RETURNING id INTO rep_b;
  INSERT INTO public.clientes (nombre,apellido,apodo,cedula,ubicacion,telefono,representante_id,empresa_id,admin_id)
    VALUES ('Ana','Gómez','La Flaca','TB-1','Y','8090000022',rep_b,emp_b,id_b) RETURNING id INTO cli_b;
  ruta_b := id_b::text || '/' || cli_b::text || '/foto.webp';
  UPDATE public.clientes SET foto_path = ruta_b WHERE id = cli_b;

  -- ═══════════ APODO ═══════════
  SELECT count(*) INTO n FROM public.clientes WHERE apodo = 'El Moreno';
  PERFORM pg_temp.chk('El apodo se guarda', 1, n);

  SELECT count(*) INTO n FROM public.clientes WHERE apodo ILIKE '%moreno%';
  PERFORM pg_temp.chk('Búsqueda parcial por apodo encuentra', 1, n);

  -- ═══════════ A sólo ve lo suyo ═══════════
  PERFORM pg_temp.como(id_a);

  SELECT foto_path INTO e FROM public.clientes WHERE id = cli_a;
  PERFORM pg_temp.chk('A ve la ruta de SU foto', ruta_a, e);

  SELECT count(*) INTO n FROM public.clientes WHERE id = cli_b;
  PERFORM pg_temp.chk('A no ve el cliente de B', 0, n);

  SELECT count(*) INTO n FROM public.clientes WHERE apodo ILIKE '%flaca%';
  PERFORM pg_temp.chk('A no encuentra por el apodo de B', 0, n);

  -- Intento de apropiarse de la foto de B apuntando a su ruta.
  BEGIN
    UPDATE public.clientes SET foto_path = ruta_b WHERE id = cli_a;
    SELECT foto_path INTO e FROM public.clientes WHERE id = cli_a;
    PERFORM pg_temp.chk('A no puede apuntar a la foto de B',
      ruta_a, coalesce(e,'(nulo)'));
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('A no puede apuntar a la foto de B', ruta_a, ruta_a);
  END;

  -- Intento de leer el objeto de B directamente en Storage.
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id='clientes-fotos' AND name = ruta_b;
  PERFORM pg_temp.chk('A no ve el objeto de B en Storage', 0, n);

  -- ═══════════ B, el caso simétrico ═══════════
  PERFORM pg_temp.como(id_b);

  SELECT count(*) INTO n FROM public.clientes WHERE id = cli_a;
  PERFORM pg_temp.chk('B no ve el cliente de A', 0, n);

  SELECT foto_path INTO e FROM public.clientes WHERE id = cli_b;
  PERFORM pg_temp.chk('B ve la ruta de SU foto', ruta_b, e);

  -- ═══════════ El megaadministrador tampoco ═══════════
  PERFORM pg_temp.como(id_mega);

  SELECT count(*) INTO n FROM public.clientes WHERE cedula LIKE 'T%-1';
  PERFORM pg_temp.chk('Megaadmin no ve clientes ni sus fotos', 0, n);

  -- ═══════════ El trigger rechaza rutas mal formadas ═══════════
  PERFORM pg_temp.sistema();
  BEGIN
    UPDATE public.clientes
       SET foto_path = 'otra-carpeta/' || cli_a::text || '/x.webp'
     WHERE id = cli_a;
    PERFORM pg_temp.chk('Ruta con tenant ajeno', 'rechazada'::text, 'ACEPTADA'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Ruta con tenant ajeno', 'rechazada'::text, 'rechazada'::text);
  END;

  BEGIN
    UPDATE public.clientes
       SET foto_path = id_a::text || '/999999/x.webp'
     WHERE id = cli_a;
    PERFORM pg_temp.chk('Ruta con otro cliente', 'rechazada'::text, 'ACEPTADA'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Ruta con otro cliente', 'rechazada'::text, 'rechazada'::text);
  END;

  PERFORM pg_temp.sistema();
END $$;

SELECT n AS "#", prueba, esperado, obtenido, veredicto FROM _r ORDER BY n;

ROLLBACK;
