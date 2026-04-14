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
- **Twilio (WhatsApp):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, **`TWILIO_WHATSAPP_FROM`** (ej. sandbox `whatsapp:+14155238886`). Opcional y deprecado: `TWILIO_WHATSAPP_NUMBER` como respaldo.

### Twilio y Resend (no va en el SQL Editor de Supabase)

Eso se configura en **variables de entorno** del servidor Next.js:

1. **Local:** copia `.env.local.example` → `.env.local` y rellena los valores.
2. **Vercel (producción):** *Project → Settings → Environment Variables* → añade las mismas claves para *Production* (y *Preview* si aplica) → **Redeploy**.

| Variable | Uso |
|----------|-----|
| `TWILIO_ACCOUNT_SID` | SID de la cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Token de autenticación Twilio |
| `TWILIO_WHATSAPP_FROM` | Remitente WhatsApp en Twilio (sandbox: `whatsapp:+14155238886`) |
| `TWILIO_WHATSAPP_NUMBER` | *(Deprecado)* mismo uso que `FROM` si no definiste `TWILIO_WHATSAPP_FROM` |
| `RESEND_API_KEY` | API key de Resend |
| `RESEND_FROM_EMAIL` | Remitente; el dominio del correo debe estar **verificado en Resend** |

Código que las usa: `src/app/api/notificaciones/enviar/route.ts` (microfinanzas) y `src/lib/twilio-whatsapp.ts`.  
**Importante:** si publicaste el Auth Token o la API key en un chat o captura, **rótalos** en Twilio y Resend y vuelve a pegar los valores nuevos solo en `.env.local` / Vercel.

### Historial de notificaciones (Twilio)

Ejecuta también `supabase/migrations/20260413120000_notificaciones_twilio_meta.sql` para columnas `twilio_from`, `twilio_to`, `twilio_message_sid` y `email_to` en `public.notificaciones` (auditoría de envíos).

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

## 6. Problemas en producción (Vercel / dominio)

### No aparece login, solo “Cargando panel”
- Causa habitual: **no están definidas** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en **Vercel → Settings → Environment Variables** (y redeploy).
- Sin esas variables no hay cookies de sesión válidas y las APIs devuelven 401.

### Tablas duplicadas en inglés (`companies`, `representatives`) vs español (`empresas`, `representantes`)
- La app **solo usa** `empresas` y `representantes`. Si tus datos están en las tablas en inglés, hay que **copiarlos** a las tablas correctas o crearlos de nuevo en el Table Editor.

### `profiles` vacío
- Cada usuario de **Authentication** debería tener una fila en `profiles` (trigger al registrarse). Si falta, inserta manualmente (reemplaza el UUID):

```sql
insert into public.profiles (id, role)
values ('UUID-DEL-USUARIO-AUTH', 'ADMIN')
on conflict (id) do update set role = excluded.role;
```

El UUID lo ves en **Authentication → Users**.

### Datos de prueba
No hace falta llenar todo para que “cargue” el panel: con **env correcto + login + perfil** basta. Para usar formularios necesitas al menos **una empresa** y **un representante** en las tablas `empresas` y `representantes` (puedes crearlos desde la app como ADMIN o en SQL).
