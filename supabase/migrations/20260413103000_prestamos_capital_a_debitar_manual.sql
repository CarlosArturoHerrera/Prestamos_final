-- Capital a debitar manual por préstamo (usado en "Próximo pago" del listado)
alter table if exists public.prestamos
  add column if not exists capital_a_debitar numeric(18, 2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prestamos_capital_a_debitar_check'
  ) then
    alter table public.prestamos
      add constraint prestamos_capital_a_debitar_check
      check (capital_a_debitar >= 0);
  end if;
end $$;
