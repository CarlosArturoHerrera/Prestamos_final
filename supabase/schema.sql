-- Simplified schema for loan management dashboard
create extension if not exists "pgcrypto";

-- Clean slate for iterative deploys
drop view if exists weekly_reports_view cascade;
drop view if exists dashboard_notifications cascade;
drop view if exists dashboard_loans cascade;
drop view if exists dashboard_clients cascade;
drop view if exists portfolio_metrics cascade;
drop view if exists portfolio_performance cascade;
drop table if exists notifications cascade;
drop table if exists deleted_loans cascade;
drop table if exists payments cascade;
drop table if exists loans cascade;
drop table if exists clients cascade;
drop table if exists segments cascade;
drop type if exists metric_tone cascade;
create table segments (
  id serial primary key,
  name text not null unique
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text not null,
  email text,
  location text,
  notes text,
  segment_id int references segments(id),
  created_at timestamptz default now()
);

create table loans (
  id text primary key,
  client_id uuid references clients(id) on delete cascade,
  principal numeric not null,
  rate numeric not null,
  term_months int not null,
  start_date date not null,
  status text not null,
  payment_days text not null default '15,30',
  created_at timestamptz default now()
);

create table payments (
  id bigserial primary key,
  loan_id text references loans(id) on delete cascade,
  due_date date not null,
  amount_due numeric not null,
  amount_paid numeric not null default 0,
  paid_at date,
  status text not null default 'pendiente',
  created_at timestamptz default now()
);

-- Track loans marcados como eliminados sin borrarlos
create table deleted_loans (
  loan_id text primary key references loans(id) on delete cascade,
  deleted_at timestamptz default now()
);

-- Notifications sent to clients
create table notifications (
  id uuid primary key default gen_random_uuid(),
  loan_id text references loans(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  type text not null default 'whatsapp',
  phone_or_email text not null,
  subject text not null,
  content text not null,
  notification_type text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Seed data
insert into segments (name) values ('Empleado'), ('Independiente'), ('Profesional'), ('Estudiante')
on conflict do nothing;

insert into clients (id, name, phone, email, segment_id)
values
  ('00000000-0000-0000-0000-000000000001', 'Laura Martínez', '+18095551234', 'laura.martinez@email.com', (select id from segments where name='Empleado')),
  ('00000000-0000-0000-0000-000000000002', 'Carlos Pérez', '+18095555678', 'carlos.perez@email.com', (select id from segments where name='Independiente')),
  ('00000000-0000-0000-0000-000000000003', 'María Gómez', '+18095559012', 'maria.gomez@email.com', (select id from segments where name='Profesional')),
  ('00000000-0000-0000-0000-000000000004', 'José Rodríguez', '+18095553456', 'jose.rodriguez@email.com', (select id from segments where name='Estudiante'))
on conflict (id) do nothing;

insert into loans (id, client_id, principal, rate, term_months, start_date, status)
values
  ('PR-1042', '00000000-0000-0000-0000-000000000001', 120000, 18.5, 24, current_date - interval '4 months', 'activo'),
  ('PR-1043', '00000000-0000-0000-0000-000000000002', 90000, 19.0, 18, current_date - interval '3 months', 'activo'),
  ('PR-1044', '00000000-0000-0000-0000-000000000003', 55000, 20.2, 12, current_date - interval '6 months', 'activo')
on conflict (id) do nothing;

insert into payments (loan_id, due_date, amount_due, amount_paid, paid_at, status)
values
  ('PR-1042', current_date + 5, 5500, 0, null, 'pendiente'),
  ('PR-1042', current_date - 25, 5500, 5500, current_date - 24, 'pagado'),
  ('PR-1043', current_date - 8, 5000, 0, null, 'vencido'),
  ('PR-1044', current_date - 20, 4800, 0, null, 'mora');

-- Disable RLS and grant public access
alter table segments disable row level security;
alter table clients disable row level security;
alter table loans disable row level security;
alter table payments disable row level security;
alter table deleted_loans disable row level security;
alter table notifications disable row level security;

-- Grant public access
grant all privileges on segments to anon, authenticated, service_role;
grant all privileges on clients to anon, authenticated, service_role;
grant all privileges on loans to anon, authenticated, service_role;
grant all privileges on payments to anon, authenticated, service_role;
grant all privileges on deleted_loans to anon, authenticated, service_role;
grant all privileges on notifications to anon, authenticated, service_role;
