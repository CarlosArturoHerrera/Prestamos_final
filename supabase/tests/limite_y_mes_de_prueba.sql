-- =============================================================================
-- Pruebas del límite de subusuarios y del mes de prueba.
--
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no queda
-- ningún dato de prueba y no se toca ni un registro real.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _r (
  n serial, prueba text, esperado text, obtenido text, veredicto text
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.chk(p text, esp anyelement, obt anyelement)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _r (prueba, esperado, obtenido, veredicto)
  VALUES (p, esp::text, obt::text,
    CASE WHEN esp::text IS NOT DISTINCT FROM obt::text
         THEN 'PASA' ELSE '*** FALLA ***' END);
END; $$;

DO $$
DECLARE
  id_adm uuid;
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  n int;
  e text;
BEGIN
  -- Las filas de prueba no cuelgan de auth.users; la FK se retira sólo dentro
  -- de esta transacción y vuelve con el ROLLBACK.
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  SELECT id INTO id_adm FROM public.profiles WHERE role='admin' LIMIT 1;

  -- ═══════════ LÍMITE DE SUBUSUARIOS ═══════════
  -- Se fija un límite de 1. El administrador ya tiene uno (Carla), así que la
  -- siguiente alta debe rebotar.
  UPDATE public.profiles SET limite_subusuarios = 1 WHERE id = id_adm;

  SELECT count(*) INTO n
    FROM public.profiles WHERE role='sub_user' AND admin_id=id_adm;
  PERFORM pg_temp.chk('Parte de 1 subusuario existente', 1, n);

  BEGIN
    INSERT INTO public.profiles (id, role, admin_id, email, username, is_active)
    VALUES (s1, 'sub_user', id_adm, 's1@test.local', 'test_s1', true);
    PERFORM pg_temp.chk('Alta por encima del límite', 'rechazada'::text, 'ACEPTADA'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Alta por encima del límite', 'rechazada'::text, 'rechazada'::text);
  END;

  -- Ampliando el límite, la misma alta pasa.
  UPDATE public.profiles SET limite_subusuarios = 3 WHERE id = id_adm;
  BEGIN
    INSERT INTO public.profiles (id, role, admin_id, email, username, is_active)
    VALUES (s2, 'sub_user', id_adm, 's2@test.local', 'test_s2', true);
    PERFORM pg_temp.chk('Alta dentro del límite ampliado', 'aceptada'::text, 'aceptada'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Alta dentro del límite ampliado', 'aceptada'::text, 'RECHAZADA'::text);
  END;

  -- Sin límite (NULL) no se restringe nada.
  UPDATE public.profiles SET limite_subusuarios = NULL WHERE id = id_adm;
  BEGIN
    INSERT INTO public.profiles (id, role, admin_id, email, username, is_active)
    VALUES (gen_random_uuid(), 'sub_user', id_adm, 's3@test.local', 'test_s3', true);
    PERFORM pg_temp.chk('Sin límite: alta libre', 'aceptada'::text, 'aceptada'::text);
  EXCEPTION WHEN others THEN
    PERFORM pg_temp.chk('Sin límite: alta libre', 'aceptada'::text, 'RECHAZADA'::text);
  END;

  -- Bajar el límite por debajo de lo que ya existe NO borra a nadie.
  UPDATE public.profiles SET limite_subusuarios = 1 WHERE id = id_adm;
  SELECT count(*) INTO n
    FROM public.profiles WHERE role='sub_user' AND admin_id=id_adm;
  PERFORM pg_temp.chk('Bajar el límite no elimina subusuarios', 3, n);

  UPDATE public.profiles SET limite_subusuarios = NULL WHERE id = id_adm;

  -- ═══════════ MES DE PRUEBA ═══════════
  -- Prueba vigente: no se cobra, el estado aguanta y no hay aviso.
  UPDATE public.admin_maintenance
     SET estado='PRUEBA', monto=1500, ultimo_pago=NULL,
         proximo_pago=current_date + 10, aviso_vencimiento_en=NULL
   WHERE admin_id=id_adm;
  PERFORM public.refrescar_estados_mantenimiento();

  SELECT estado::text INTO e FROM public.admin_maintenance WHERE admin_id=id_adm;
  PERFORM pg_temp.chk('Prueba vigente sigue en PRUEBA', 'PRUEBA'::text, e);

  SELECT count(*) INTO n FROM public.mantenimientos_por_avisar();
  PERFORM pg_temp.chk('Prueba vigente no genera aviso', 0, n);

  -- La prueba termina: pasa a VENCIDO y entra en la cola de avisos.
  UPDATE public.admin_maintenance
     SET proximo_pago = current_date - 1 WHERE admin_id=id_adm;
  PERFORM public.refrescar_estados_mantenimiento();

  SELECT estado::text INTO e FROM public.admin_maintenance WHERE admin_id=id_adm;
  PERFORM pg_temp.chk('Prueba terminada pasa a VENCIDO', 'VENCIDO'::text, e);

  SELECT count(*) INTO n FROM public.mantenimientos_por_avisar();
  PERFORM pg_temp.chk('Vencimiento entra en la cola de avisos', 1, n);

  SELECT venia_de_prueba INTO e FROM public.mantenimientos_por_avisar() LIMIT 1;
  PERFORM pg_temp.chk('Se reconoce que venía de una prueba', 'true'::text, e);

  -- Tras avisar, no se repite.
  PERFORM public.marcar_aviso_mantenimiento(id_adm);
  SELECT count(*) INTO n FROM public.mantenimientos_por_avisar();
  PERFORM pg_temp.chk('Avisado una vez, no se repite', 0, n);

  -- Al pagar, vuelve al ciclo normal.
  PERFORM public.registrar_pago_mantenimiento(id_adm, 1500, current_date, 'Transferencia', '__t__');
  SELECT estado::text INTO e FROM public.admin_maintenance WHERE admin_id=id_adm;
  PERFORM pg_temp.chk('Tras pagar queda AL_DIA', 'AL_DIA'::text, e);

  -- EXENTO sigue sin recalcularse.
  UPDATE public.admin_maintenance
     SET estado='EXENTO', proximo_pago=current_date-30 WHERE admin_id=id_adm;
  PERFORM public.refrescar_estados_mantenimiento();
  SELECT estado::text INTO e FROM public.admin_maintenance WHERE admin_id=id_adm;
  PERFORM pg_temp.chk('EXENTO no se recalcula', 'EXENTO'::text, e);
END $$;

SELECT n AS "#", prueba, esperado, obtenido, veredicto FROM _r ORDER BY n;

ROLLBACK;
