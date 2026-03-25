-- Historial de abonos: interés calculado vs recibido y diferencia a pendientes
alter table if exists public.abonos
  add column if not exists interes_calculado numeric(18, 2);

alter table if exists public.abonos
  add column if not exists diferencia_interes_pendiente numeric(18, 2) not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'abonos'
      and column_name = 'pago_recibido'
  )
     and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'abonos'
      and column_name = 'interes_recibido'
  ) then
    alter table public.abonos rename column pago_recibido to interes_recibido;
  end if;
end
$$;

alter table if exists public.abonos
  add column if not exists interes_recibido numeric(18, 2);
