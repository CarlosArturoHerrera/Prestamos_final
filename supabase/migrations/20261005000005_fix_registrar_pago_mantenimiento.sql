-- =============================================================================
-- Corrección: registrar_pago_mantenimiento() fallaba al escribir el estado.
--
-- El error
-- --------
--   ERROR 42804: column "estado" is of type estado_mantenimiento
--                but expression is of type text
--
-- La causa: en
--
--     estado = CASE WHEN estado = 'EXENTO' THEN 'EXENTO' ELSE 'AL_DIA' END
--
-- las dos ramas son literales sin tipo, así que Postgres resuelve el CASE
-- completo como `text` y luego no lo deja asignar a una columna enum. Que la
-- comparación `estado = 'EXENTO'` sí funcione despista: ahí el literal se
-- infiere del tipo de la columna, pero en el resultado del CASE no hay nada
-- de donde inferirlo.
--
-- La solución es castear explícitamente ambas ramas al enum.
--
-- Esto rompía el boton "Registrar pago" del panel de mantenimiento. No afecta
-- a ningún dato ya guardado ni a la lógica financiera de los préstamos.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_pago_mantenimiento(
  p_admin_id uuid,
  p_monto    numeric,
  p_fecha    date DEFAULT current_date,
  p_metodo   text DEFAULT NULL,
  p_notas    text DEFAULT NULL
)
RETURNS public.admin_maintenance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dia int;
  v_res public.admin_maintenance;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permiso denegado: se requiere megaadministrador';
  END IF;

  INSERT INTO public.admin_maintenance (admin_id) VALUES (p_admin_id)
    ON CONFLICT (admin_id) DO NOTHING;

  INSERT INTO public.admin_maintenance_payments
    (admin_id, monto, fecha_pago, periodo, metodo, notas, registrado_por)
  VALUES
    (p_admin_id, p_monto, p_fecha, date_trunc('month', p_fecha)::date,
     p_metodo, p_notas, auth.uid());

  SELECT dia_pago INTO v_dia FROM public.admin_maintenance WHERE admin_id = p_admin_id;

  -- Si todavía no hay día de pago configurado, se toma el del propio pago:
  -- así registrar un pago basta para dejar programado el siguiente cobro.
  IF v_dia IS NULL THEN
    v_dia := extract(day FROM p_fecha)::int;
    UPDATE public.admin_maintenance SET dia_pago = v_dia WHERE admin_id = p_admin_id;
  END IF;

  UPDATE public.admin_maintenance
    SET ultimo_pago  = p_fecha,
        proximo_pago = public.calcular_proximo_pago(v_dia, p_fecha),
        -- Ambas ramas casteadas al enum: sin esto el CASE se resuelve como
        -- text y Postgres rechaza la asignación.
        estado       = CASE
                         WHEN estado = 'EXENTO'
                           THEN 'EXENTO'::public.estado_mantenimiento
                         ELSE 'AL_DIA'::public.estado_mantenimiento
                       END,
        updated_at   = now()
    WHERE admin_id = p_admin_id
    RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_mantenimiento(uuid, numeric, date, text, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_mantenimiento(uuid, numeric, date, text, text)
  TO authenticated, service_role;

COMMIT;
