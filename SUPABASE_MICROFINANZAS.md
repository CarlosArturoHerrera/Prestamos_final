# Supabase — esquema microfinanzas

## 1. Ejecutar la migración SQL

En el **SQL Editor** de tu proyecto Supabase, ejecuta el archivo:

`supabase/migrations/20250321000000_microfinanzas.sql`

Esto crea: `profiles` (roles `ADMIN` / `OPERADOR`), `empresas`, `representantes`, `clientes`, `prestamos`, `reganches`, `abonos`, `intereses_atrasados`, `notificaciones`, y el trigger que crea `profiles` al registrarse un usuario en **Auth**.

> Si el trigger sobre `auth.users` falla por permisos, crea el perfil a mano (paso 3).

## 2. Variables de entorno (.env.local)

Copia `.env.local.example` y define al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Opcional:

- **Resend (email):** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (ej. `Cartera <onboarding@tudominio.com>`)
- **Twilio (WhatsApp):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (formato `+1...` o `whatsapp:+1...`)

## 3. Primer usuario y rol ADMIN

1. En **Authentication → Users**, crea un usuario o regístrate desde la app (`/login`).
2. En **Table Editor → `profiles`**, localiza la fila con el `id` del usuario y pon `role = 'ADMIN'`.

Los nuevos usuarios reciben por defecto `OPERADOR` (trigger).

## 4. Reglas que implementa la app

- **Tasa:** se guarda en **porcentaje** por período (ej. `5` = 5%).
- **Plazo:** número de **cuotas**; la última fecha de contrato es `fecha_inicio + plazo × período`.
- **Reganche:** es sobre el **mismo préstamo**: aumenta `monto` y `capital_pendiente` y deja historial en `reganches`.
- **Interés por período:** `capitalPendiente × (tasa / 100)`.
- **Mora:** si pasan **más de 3 días** tras la fecha de cuota sin cubrir el período, se genera un registro en `intereses_atrasados` (no se capitaliza solo: el operador aplica con **“Aplicar todos al capital”**).

## 5. Next.js 16 — Proxy

La sesión de Supabase se renueva en `src/proxy.ts` (antes `middleware`). Asegúrate de tener las variables `NEXT_PUBLIC_*` en el entorno de build y de Vercel/hosting.
