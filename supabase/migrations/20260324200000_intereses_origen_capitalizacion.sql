-- Origen de la capitalización (manual vs automática tras +3 días sin cubrir interés)
alter table if exists public.intereses_atrasados
  add column if not exists origen_capitalizacion text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intereses_atrasados_origen_capitalizacion_check'
  ) then
    alter table public.intereses_atrasados
      add constraint intereses_atrasados_origen_capitalizacion_check
      check (origen_capitalizacion is null or origen_capitalizacion in ('AUTO', 'MANUAL'));
  end if;
end
$$;
