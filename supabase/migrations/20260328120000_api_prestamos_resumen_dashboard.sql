-- Agregaciones para /api/prestamos/resumen en una sola llamada (menos roundtrips y sin traer tablas completas al Node).

create or replace function public.api_prestamos_resumen_dashboard(
  p_today date,
  p_plus7 date,
  p_desde_7d timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'totalPrestado',
    coalesce((select sum(p.monto::numeric) from public.prestamos p), 0),
    'capitalPendiente',
    coalesce(
      (
        select sum(p.capital_pendiente::numeric)
        from public.prestamos p
        where p.estado <> 'SALDADO'::public.estado_prestamo
      ),
      0
    ),
    'interesPendienteAcumulado',
    coalesce(
      (
        select sum(coalesce(i.interes_pendiente, i.monto, 0)::numeric)
        from public.intereses_atrasados i
        where i.estado = 'PENDIENTE'
      ),
      0
    ),
    'capitalizacionAuto',
    coalesce(
      (
        select sum(r.monto_agregado::numeric)
        from public.reganches r
        where r.notas like 'AUTO:%'
      ),
      0
    ),
    'capitalizacionManual',
    coalesce(
      (
        select sum(r.monto_agregado::numeric)
        from public.reganches r
        where r.notas like 'MANUAL:%'
      ),
      0
    ),
    'prestamosMora',
    (select count(*)::int from public.prestamos p where p.estado = 'MORA'::public.estado_prestamo),
    'prestamosSaldados',
    (select count(*)::int from public.prestamos p where p.estado = 'SALDADO'::public.estado_prestamo),
    'prestamosActivos',
    (select count(*)::int from public.prestamos p where p.estado = 'ACTIVO'::public.estado_prestamo),
    'vencenProximos7Dias',
    (
      select count(*)::int
      from public.prestamos p
      where p.estado <> 'SALDADO'::public.estado_prestamo
        and p.fecha_proximo_vencimiento >= p_today
        and p.fecha_proximo_vencimiento <= p_plus7
    ),
    'prestamosConInteresPendiente',
    (
      select count(distinct i.prestamo_id)::int
      from public.intereses_atrasados i
      where i.estado = 'PENDIENTE'
        and i.interes_pendiente > 0
    ),
    'capitalizacionesAutoUltimos7Dias',
    (
      select count(*)::int
      from public.reganches r
      where r.notas like 'AUTO:%'
        and r.created_at >= p_desde_7d
    )
  );
$$;

comment on function public.api_prestamos_resumen_dashboard(date, date, timestamptz) is
  'Métricas agregadas del portafolio para el dashboard (equivalente semántico al resumen previo en Node).';

grant execute on function public.api_prestamos_resumen_dashboard(date, date, timestamptz) to anon;
grant execute on function public.api_prestamos_resumen_dashboard(date, date, timestamptz) to authenticated;
grant execute on function public.api_prestamos_resumen_dashboard(date, date, timestamptz) to service_role;
