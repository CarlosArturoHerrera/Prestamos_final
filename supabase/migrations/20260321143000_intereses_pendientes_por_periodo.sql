-- Intereses pendientes por período (sin capitalización automática)

alter table if exists public.intereses_atrasados
  add column if not exists fecha_periodo date;

alter table if exists public.intereses_atrasados
  add column if not exists interes_generado numeric(18, 2);

alter table if exists public.intereses_atrasados
  add column if not exists interes_pagado numeric(18, 2) not null default 0;

alter table if exists public.intereses_atrasados
  add column if not exists interes_pendiente numeric(18, 2);

alter table if exists public.intereses_atrasados
  add column if not exists estado text not null default 'PENDIENTE';

alter table if exists public.intereses_atrasados
  add column if not exists updated_at timestamptz not null default now();

-- Backfill desde estructura previa
update public.intereses_atrasados
set
  fecha_periodo = coalesce(fecha_periodo, fecha_generado),
  interes_generado = coalesce(interes_generado, monto),
  interes_pagado = coalesce(
    interes_pagado,
    case when aplicado then monto else 0 end
  ),
  interes_pendiente = coalesce(
    interes_pendiente,
    case when aplicado then 0 else monto end
  ),
  estado = case
    when estado in ('PENDIENTE', 'PAGADO', 'CAPITALIZADO', 'ANULADO') then estado
    when aplicado then 'CAPITALIZADO'
    else 'PENDIENTE'
  end;

-- Constraint de estados válidos
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intereses_atrasados_estado_check'
  ) then
    alter table public.intereses_atrasados
      add constraint intereses_atrasados_estado_check
      check (estado in ('PENDIENTE', 'PAGADO', 'CAPITALIZADO', 'ANULADO'));
  end if;
end
$$;

-- Un interés por préstamo y período (evita duplicados por recálculos/re-renders)
create unique index if not exists ux_intereses_prestamo_periodo
  on public.intereses_atrasados (prestamo_id, fecha_periodo);

-- Trigger updated_at
create or replace function public.set_updated_at_intereses()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_intereses_atrasados_updated on public.intereses_atrasados;
create trigger trg_intereses_atrasados_updated
before update on public.intereses_atrasados
for each row execute procedure public.set_updated_at_intereses();
