# 🔧 Configuración del Proyecto

## Variables de Entorno Requeridas

Para que el proyecto funcione correctamente, necesitas crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
# Supabase (Base de datos)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima

# Twilio (Notificaciones WhatsApp)
TWILIO_ACCOUNT_SID=tu-account-sid
TWILIO_AUTH_TOKEN=tu-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Seguridad de Cron Jobs
CRON_SECRET=una-clave-secreta-aleatoria

# URL de la aplicación
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Pasos de Configuración

### 1. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. En la configuración del proyecto, copia:
   - **URL del proyecto** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ejecuta el schema de la base de datos:
   - Ve a SQL Editor en Supabase
   - Copia y pega el contenido de `supabase/schema.sql`
   - Ejecuta el script

### 2. Configurar Twilio (Opcional - para WhatsApp)

1. Ve a [twilio.com](https://www.twilio.com) y crea una cuenta
2. Activa Twilio Sandbox para WhatsApp
3. Copia las credenciales:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
   - **Sandbox From (WhatsApp)** → `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`

### 3. Configurar Cron Jobs (Producción en Vercel)

1. Genera una clave secreta: `openssl rand -base64 32`
2. Agrégala como → `CRON_SECRET`
3. En Vercel, agrega todas las variables de entorno en Project Settings → Environment Variables

## Verificar Configuración

Después de configurar `.env.local`, ejecuta:

```bash
bun run dev
```

Si todo está bien, verás:
- ✅ La app corre en http://localhost:3000
- ✅ Los datos de clientes y préstamos se cargan
- ✅ No hay errores en la consola sobre Supabase

## Problemas Comunes

### "No se pudieron cargar las notificaciones"
- Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas
- Asegúrate de que el schema esté ejecutado en Supabase
- Revisa que la tabla `notifications` exista

### "Cannot read properties of undefined"
- Reinicia el servidor de desarrollo después de agregar variables de entorno
- Verifica que las variables empiecen con `NEXT_PUBLIC_` para uso en el cliente

### Cron jobs no se ejecutan
- Los cron jobs solo funcionan en producción (Vercel)
- En desarrollo, puedes probar los endpoints manualmente con curl/Postman
