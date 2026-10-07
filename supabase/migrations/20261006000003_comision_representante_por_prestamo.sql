-- =============================================================================
-- Comisión del representante, definida POR PRÉSTAMO.
--
-- Qué cambia
-- ----------
-- Hasta ahora la comisión se DEDUCÍA de la tasa del préstamo mediante una tabla
-- fija en el código (`COMISION_POR_TASA` en src/lib/ganancias-representante.ts):
--     tasa 4 %  →  comisión 1 % del capital  →  interés × (1/4)   = 25 % del interés
--     tasa 5 %  →  comisión 1.5 % del capital →  interés × (1.5/5) = 30 % del interés
-- Cualquier otra tasa no comisionaba.
--
-- A partir de aquí cada préstamo guarda su propio porcentaje y la ganancia es
-- simplemente `interés pagado × porcentaje`.
--
-- ⚠ EL PORCENTAJE CAMBIA DE BASE
-- ------------------------------
-- El valor guardado es un porcentaje DEL INTERÉS EFECTIVAMENTE PAGADO, no del
-- capital. Por eso los préstamos históricos se migran a 25 % y 30 %, no a 1 % y
-- 1.5 %: son las cifras que producen EXACTAMENTE la misma ganancia que el
-- sistema viene pagando.
--
--     tasa 4 % → 25 %   (antes: interés × 1/4   = 25 % del interés)
--     tasa 5 % → 30 %   (antes: interés × 1.5/5 = 30 % del interés)
--
-- Guardar 1 % y 1.5 % con la fórmula nueva habría reducido las ganancias de los
-- representantes unas 22 veces.
--
-- Qué NO cambia
-- -------------
-- Ni capital, ni tasas, ni cuotas, ni fechas, ni abonos, ni intereses, ni el
-- estado de ningún préstamo. Sólo se añade una columna y se rellena.
-- =============================================================================

BEGIN;

-- ── 1. La columna ───────────────────────────────────────────────────────────
-- numeric(6,3) admite de 0.000 a 100.000 con tres decimales: suficiente para
-- 1.25 %, 1.5 %, 25 %, 33.333 %… sin arrastrar errores de coma flotante.
ALTER TABLE public.prestamos
  ADD COLUMN IF NOT EXISTS comision_representante numeric(6,3);

ALTER TABLE public.prestamos
  DROP CONSTRAINT IF EXISTS prestamos_comision_representante_check;
ALTER TABLE public.prestamos
  ADD CONSTRAINT prestamos_comision_representante_check
  CHECK (comision_representante IS NULL
         OR (comision_representante >= 0 AND comision_representante <= 100));

COMMENT ON COLUMN public.prestamos.comision_representante IS
  'Porcentaje sobre el INTERÉS EFECTIVAMENTE PAGADO que corresponde al representante de este préstamo. NULL o 0 = sin comisión.';

-- ── 2. Migración de los préstamos históricos ────────────────────────────────
-- Acotada por admin_id, nunca por nombre. Si el administrador no se localiza o
-- hay más de uno, la migración ABORTA: es preferible no tocar nada a repartir
-- comisiones sobre la cartera equivocada.
DO $$
DECLARE
  v_admin uuid;
  v_n int;
  v_4 int;
  v_5 int;
  v_otras int;
BEGIN
  SELECT id INTO v_admin
    FROM public.profiles
   WHERE role = 'admin' AND lower(email) = 'herreraeliasm@gmail.com';

  IF v_admin IS NULL THEN
    RAISE EXCEPTION
      'No se localizó al administrador Carlos Elias Herrera Montilla. Migración abortada.';
  END IF;

  -- Sólo préstamos de ESE administrador y sólo los que aún no tienen valor:
  -- re-ejecutar la migración no pisa nada que se haya ajustado a mano.
  UPDATE public.prestamos
     SET comision_representante = 25.000
   WHERE admin_id = v_admin
     AND comision_representante IS NULL
     AND round(tasa_interes::numeric, 4) = 4.0000;
  GET DIAGNOSTICS v_4 = ROW_COUNT;

  UPDATE public.prestamos
     SET comision_representante = 30.000
   WHERE admin_id = v_admin
     AND comision_representante IS NULL
     AND round(tasa_interes::numeric, 4) = 5.0000;
  GET DIAGNOSTICS v_5 = ROW_COUNT;

  -- Las tasas que antes no comisionaban siguen sin comisionar: 0, explícito.
  UPDATE public.prestamos
     SET comision_representante = 0.000
   WHERE admin_id = v_admin
     AND comision_representante IS NULL;
  GET DIAGNOSTICS v_otras = ROW_COUNT;

  SELECT count(*) INTO v_n FROM public.prestamos WHERE admin_id = v_admin;

  RAISE NOTICE 'Administrador %: % prestamos. Al 4%% -> 25%%: %. Al 5%% -> 30%%: %. Otras tasas -> 0: %.',
    v_admin, v_n, v_4, v_5, v_otras;
END $$;

COMMIT;

-- ── Verificación: la ganancia no debe moverse ───────────────────────────────
-- Compara, préstamo a préstamo, lo que pagaba la lógica vieja (deducida de la
-- tasa) con lo que paga la nueva (porcentaje guardado). La columna `diferencia`
-- tiene que ser 0.00 en todas las filas.
WITH interes_por_prestamo AS (
  SELECT p.id, p.tasa_interes, p.comision_representante,
         coalesce((SELECT sum(a.interes_cobrado) FROM public.abonos a
                    WHERE a.prestamo_id = p.id), 0)
         + coalesce((SELECT sum(greatest(
                         coalesce(i.interes_generado, i.monto, 0)
                       - coalesce(i.interes_pagado, 0), 0))
                       FROM public.intereses_atrasados i
                      WHERE i.prestamo_id = p.id AND i.estado = 'PAGADO'), 0)
         AS interes_pagado
    FROM public.prestamos p
)
SELECT
  round(tasa_interes::numeric, 2)      AS tasa,
  comision_representante               AS comision_nueva,
  count(*)::int                        AS prestamos,
  round(sum(interes_pagado), 2)        AS interes_pagado,
  round(sum(interes_pagado * CASE round(tasa_interes::numeric, 4)
              WHEN 4.0000 THEN 1.0/4 WHEN 5.0000 THEN 1.5/5 ELSE 0 END), 2)
                                       AS ganancia_logica_vieja,
  round(sum(interes_pagado * coalesce(comision_representante, 0) / 100), 2)
                                       AS ganancia_logica_nueva,
  round(sum(interes_pagado * coalesce(comision_representante, 0) / 100)
      - sum(interes_pagado * CASE round(tasa_interes::numeric, 4)
              WHEN 4.0000 THEN 1.0/4 WHEN 5.0000 THEN 1.5/5 ELSE 0 END), 2)
                                       AS diferencia
FROM interes_por_prestamo
GROUP BY round(tasa_interes::numeric, 2), comision_representante
ORDER BY 1;
