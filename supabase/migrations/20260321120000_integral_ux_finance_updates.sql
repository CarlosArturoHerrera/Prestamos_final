-- Actualización integral:
-- 1) Empresas: transición RUC -> RNC (RNC opcional)
-- 2) Clientes: estado de validación editable
-- 3) Abonos: registrar pago recibido manualmente
-- 4) Representantes: protección anti-duplicado por email (case-insensitive)

-- 1) Empresas (RNC)
alter table if exists public.empresas
  add column if not exists rnc text;

update public.empresas
set rnc = ruc
where rnc is null and ruc is not null;

-- 2) Clientes (estado de validación)
alter table if exists public.clientes
  add column if not exists estado_validacion text not null default 'VALIDADO';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clientes_estado_validacion_check'
  ) then
    alter table public.clientes
      add constraint clientes_estado_validacion_check
      check (estado_validacion in ('VALIDADO', 'PENDIENTE_VALIDAR'));
  end if;
end
$$;

create index if not exists idx_clientes_estado_validacion
  on public.clientes (estado_validacion);

-- 3) Abonos (pago manual capturado)
alter table if exists public.abonos
  add column if not exists pago_recibido numeric(18, 2);

-- 4) Representantes (email único sin importar mayúsculas)
create unique index if not exists ux_representantes_email_lower
  on public.representantes (lower(email));
