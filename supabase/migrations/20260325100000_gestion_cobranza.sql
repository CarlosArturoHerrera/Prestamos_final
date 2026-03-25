-- Seguimiento operativo de cobranza (notas, promesas, próximo contacto, resultado).
-- No modifica lógica financiera de préstamos ni abonos.
-- Ejecución idempotente: enum/tabla/índices solo se crean si no existen.

-- =============================================================================
-- 1) Tipo enum de resultado de gestión
--    Define los valores permitidos en columna `resultado`. Si el tipo ya existe
--    (re-ejecución o migración parcial), se ignora el error y no se altera.
-- =============================================================================
do $$
begin
  create type public.resultado_gestion_cobranza as enum (
    'CONTACTADO',
    'NO_RESPONDE',
    'PAGARA_HOY',
    'PAGARA_DESPUES',
    'RENEGOCIACION',
    'PROMESA_CUMPLIDA',
    'PROMESA_INCUMPLIDA',
    'OTRO'
  );
exception
  when duplicate_object then
    null;
end $$;

-- =============================================================================
-- 2) Tabla principal de historial de gestión / cobranza
--    Una fila = un contacto o nota operativa. Siempre ligada a un cliente;
--    opcionalmente a un préstamo concreto. `creado_por` apunta al usuario (profiles).
-- =============================================================================
create table if not exists public.gestion_cobranza (
  id serial primary key,
  cliente_id int not null references public.clientes (id) on delete cascade,
  prestamo_id int references public.prestamos (id) on delete set null,
  notas text not null default '',
  promesa_monto numeric(18, 2),
  promesa_fecha date,
  proxima_fecha_contacto date,
  resultado public.resultado_gestion_cobranza not null,
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 3) Índices para listados (por cliente / préstamo ordenados por fecha)
--    y para agenda (filtrar por próxima fecha de contacto no nula).
--    IF NOT EXISTS evita error si la migración se ejecuta dos veces.
-- =============================================================================
create index if not exists idx_gestion_cobranza_cliente_created
  on public.gestion_cobranza (cliente_id, created_at desc);

create index if not exists idx_gestion_cobranza_prestamo_created
  on public.gestion_cobranza (prestamo_id, created_at desc);

create index if not exists idx_gestion_cobranza_proxima
  on public.gestion_cobranza (proxima_fecha_contacto)
  where proxima_fecha_contacto is not null;

-- =============================================================================
-- 4) RLS deshabilitado (mismo criterio que el resto de tablas operativas del proyecto;
--    la app controla acceso vía sesión en las rutas API).
-- =============================================================================
alter table public.gestion_cobranza disable row level security;
