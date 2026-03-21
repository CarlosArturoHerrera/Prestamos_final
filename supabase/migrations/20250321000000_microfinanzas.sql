-- Esquema microfinanzas: empresas, representantes, clientes, préstamos (reganche en el mismo préstamo),
-- abonos, intereses atrasados, notificaciones, perfiles con rol.
-- Ejecutar en Supabase SQL Editor o con CLI tras backup.

begin;

create extension if not exists "pgcrypto";

-- Legado (dashboard anterior)
drop table if exists public.notifications cascade;
drop table if exists public.deleted_loans cascade;
drop table if exists public.payments cascade;
drop table if exists public.loans cascade;
drop table if exists public.clients cascade;
drop table if exists public.segments cascade;

drop type if exists public.estado_notificacion cascade;
drop type if exists public.canal_notificacion cascade;
drop type if exists public.estado_prestamo cascade;
drop type if exists public.tipo_plazo cascade;

-- Perfiles (roles) ligados a auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'OPERADOR' check (role in ('ADMIN', 'OPERADOR')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'OPERADOR')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.empresas (
  id serial primary key,
  nombre text not null unique,
  ruc text,
  direccion text,
  telefono text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.representantes (
  id serial primary key,
  nombre text not null,
  apellido text not null,
  telefono text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clientes (
  id serial primary key,
  nombre text not null,
  apellido text not null,
  cedula text not null unique,
  ubicacion text not null,
  telefono text not null,
  ultimo_pago date,
  representante_id int not null references public.representantes (id) on delete restrict,
  empresa_id int not null references public.empresas (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clientes_cedula on public.clientes (cedula);
create index idx_clientes_nombre on public.clientes (nombre, apellido);
create index idx_clientes_rep on public.clientes (representante_id);
create index idx_clientes_emp on public.clientes (empresa_id);

create type public.tipo_plazo as enum ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL');
create type public.estado_prestamo as enum ('ACTIVO', 'SALDADO', 'MORA');

create table public.prestamos (
  id serial primary key,
  cliente_id int not null references public.clientes (id) on delete restrict,
  monto numeric(18, 2) not null,
  tasa_interes numeric(18, 4) not null,
  plazo int not null check (plazo > 0),
  tipo_plazo public.tipo_plazo not null,
  fecha_inicio date not null,
  fecha_vencimiento date not null,
  fecha_proximo_vencimiento date not null,
  capital_pendiente numeric(18, 2) not null,
  estado public.estado_prestamo not null default 'ACTIVO',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_prestamos_cliente on public.prestamos (cliente_id);
create index idx_prestamos_estado on public.prestamos (estado);

-- Historial de reganches (mismo préstamo: aumenta capital)
create table public.reganches (
  id serial primary key,
  prestamo_id int not null references public.prestamos (id) on delete cascade,
  monto_agregado numeric(18, 2) not null check (monto_agregado > 0),
  notas text,
  created_at timestamptz not null default now()
);

create index idx_reganches_prestamo on public.reganches (prestamo_id);

create table public.abonos (
  id serial primary key,
  prestamo_id int not null references public.prestamos (id) on delete cascade,
  fecha_abono date not null,
  monto_capital_debitado numeric(18, 2) not null check (monto_capital_debitado >= 0),
  interes_cobrado numeric(18, 2) not null,
  total_pagado numeric(18, 2) not null,
  saldo_capital_restante numeric(18, 2) not null,
  observaciones text,
  created_at timestamptz not null default now()
);

create index idx_abonos_prestamo on public.abonos (prestamo_id);

create table public.intereses_atrasados (
  id serial primary key,
  prestamo_id int not null references public.prestamos (id) on delete cascade,
  fecha_generado date not null,
  monto numeric(18, 2) not null,
  aplicado boolean not null default false,
  fecha_aplicado date,
  created_at timestamptz not null default now()
);

create index idx_intereses_prestamo on public.intereses_atrasados (prestamo_id);

create type public.canal_notificacion as enum ('WHATSAPP', 'EMAIL', 'AMBOS');
create type public.estado_notificacion as enum ('ENVIADO', 'ERROR');

create table public.notificaciones (
  id serial primary key,
  representante_id int not null references public.representantes (id) on delete cascade,
  canal public.canal_notificacion not null,
  mensaje text not null,
  clientes_incluidos jsonb not null default '[]'::jsonb,
  fecha_envio timestamptz not null default now(),
  estado public.estado_notificacion not null,
  error_detalle text
);

create index idx_notif_rep on public.notificaciones (representante_id);
create index idx_notif_fecha on public.notificaciones (fecha_envio desc);

-- updated_at triggers
create trigger trg_empresas_updated before update on public.empresas
  for each row execute procedure public.set_updated_at();
create trigger trg_representantes_updated before update on public.representantes
  for each row execute procedure public.set_updated_at();
create trigger trg_clientes_updated before update on public.clientes
  for each row execute procedure public.set_updated_at();
create trigger trg_prestamos_updated before update on public.prestamos
  for each row execute procedure public.set_updated_at();

-- RLS deshabilitado: la app valida sesión y roles en API Routes (mismo patrón que schema legado)
alter table public.profiles disable row level security;
alter table public.empresas disable row level security;
alter table public.representantes disable row level security;
alter table public.clientes disable row level security;
alter table public.prestamos disable row level security;
alter table public.reganches disable row level security;
alter table public.abonos disable row level security;
alter table public.intereses_atrasados disable row level security;
alter table public.notificaciones disable row level security;

grant all on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

commit;
