# ERP de Préstamos con IA

Sistema de gestión de cartera de microcréditos y cobranza, con panel administrativo, reportes, notificaciones y un chatbot conversacional inteligente.

> Nota: Reemplaza este README con tu documentación técnica y de usuario. Aquí se describe la versión funcional actual del proyecto.

## 🚀 Funcionalidades principales

- Gestión completa de:
  - Empresas
  - Representantes
  - Clientes
  - Segmentos
  - Préstamos (creación, edición, eliminación soft)
  - Abonos y pagos
  - Gestión de cobranza
  - Historial de notificaciones
- Sistema de autenticación y sesión con Supabase.
- Panel de control con métricas en tiempo real y análisis de cartera.
- Reportes y filtrado de préstamos por estado (activo, moroso, en riesgo, pagado).
- Motor de reglas de intereses y cálculo automático de saldo pendiente.
- Notificaciones por WhatsApp/SMS vía Twilio y sistema de cron para envío automatizado.
- Integración de Chatbot IA con:
  - Endpoint `/api/chat` (GROQ + Vercel AI SDK)
  - Contexto en vivo con datos de Supabase
  - Soporte de streaming de respuesta
- Administración de envíos manuales de notificaciones y registro histórico.

## 📦 Stack tecnológico

- Next.js 16
- React 19
- Supabase (PostgreSQL)
- Vercel AI (GROQ + `ai` package)
- Elevenlabs (TTS y STT)
- Twilio (WhatsApp)
- Tailwind CSS + shadcn/ui
- TypeScript

## ⚙️ Instalación rápida

1. Clona el repositorio:

```bash
git clone https://github.com/CarlosArturoHerrera/Prestamos_final.git
cd Prestamos_final
```

2. Instala dependencias:

```bash
npm install
```

3. Crea `.env.local` con las variables necesarias (ver sección siguiente).

4. Inicializa la base de datos en Supabase:

- Ejecuta el SQL de `supabase/schema.sql`
- Opcional: migraciones en `supabase/migrations`

5. Arranca la aplicación:

```bash
npm run dev
```

6. Abre: `http://localhost:3000`

## 🛡️ Variables de entorno (mínimo)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>

# Chat IA
GROQ_API_KEY=<tu-groq-api-key>

# Twilio (opcional para WhatsApp)
TWILIO_ACCOUNT_SID=<tu-account-sid>
TWILIO_AUTH_TOKEN=<tu-auth-token>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Cron Jobs
CRON_SECRET=<una-clave-secreta>

# URL pública
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 🗂️ Estructura clave de carpetas

- `src/app/` - rutas de Next API y páginas de aplicación
- `src/components/` - UI modular de dashboard
- `src/lib/` - lógica de negocio (cobranza, préstamos, notificaciones, IA)
- `src/app/api/` - endpoints REST para clientes, préstamos, notificaciones, dashboard, chat, etc.
- `supabase/` - SQL schema y migraciones

## 🧩 API principales

### Clientes
- `GET /api/clients` (filtrado con `search`)
- `POST /api/clients/create`
- `PUT /api/clients/update`

### Segmentos
- `GET /api/segments`

### Préstamos
- `GET /api/loans` (filtrado con `search`)
- `POST /api/loans/create`
- `POST /api/loans/update`
- `POST /api/loans/delete` (soft delete)

### Notificaciones
- `GET /api/notifications`
- `POST /api/notifications/send`

### Dashboard
- `GET /api/dashboard/clients-segment`
- `GET /api/dashboard/loans-segment`
- `GET /api/dashboard/notifications-segment`

### Gestores de cobranza
- `POST /api/prestamos/{id}/gestion-cobranza`
- `POST /api/clientes/{id}/gestion-cobranza`

### Chat IA
- `POST /api/chat`

## 🔍 Módulos de IA y voz

- `src/app/api/chat/route.ts`: endpoint principal de chatbot con groq y Supabase
- `src/lib/ai-helpers.ts`: funciones para consultas de cartera, clientes y préstamos
- `src/components/dashboard/chat-sidebar.tsx`: UI de chat streaming
- `src/app/api/speech-to-text/route.ts`: ruta para transcribir audio
##- `src/lib/speech-to-text.ts`: captura y API de transcripción
##- `src/lib/text-to-speech.ts`: generación de audio con Eleven Labs

## 📊 Funciones de negocio (cobranza + reportes)

- Cálculo de intereses y saldo pendiente
- Detección de mora y clasificación de riesgo
- Panel de gestión de cobranza (resultados de gestión, comentarios)
- Reportes de cartera, clientes y préstamos
- Historial de notificaciones enviadas y segmentadas

## 🔄 Flujo de notificaciones automáticas

1. Cron job de Vercel ejecuta `/api/cron/notificaciones` (según `CRON_SECRET`)
2. Se consultan préstamos vencidos/moratarios
3. Se crea registro en `notifications` y se envía WhatsApp/SMS con Twilio
4. Se actualiza estado de notificación

## ✅ Comandos útiles

- `npm run dev` - desarrollo
- `npm run build` - producción
- `npm run start` - run server de producción (después de build)
- `npm run lint` - revisión de código con biome
- `npm run format` - formateo con biome
- `npm run db:verify` - verifica y siembra datos (script custom)

## 📚 Documentación adicional

- `SETUP.md` - configuración de entorno, Supabase y Twilio
- `NOTIFICATIONS_SETUP.md` - configuración de notificaciones y cron jobs
- `CHATBOT_SETUP.md` - arquitectura y flujo del chatbot IA
- `CHATBOT_QUICKSTART.md` - guía rápida de uso
- `CHATBOT_EXAMPLES.md` - ejemplos de prompts y pruebas
- `POSTMAN_API_REFERENCE.md` - referencia de endpoints para Postman
- `MEJORAS_ROBUSTEZ.md` - mejoras de UX, manejo de errores y seguridad

## 📝 Sugerencias de uso

- Configura Supabase antes de arrancar para evitar fallos de sesión
- Revisa el `supabase/schema.sql` para garantizar integridad de tablas
- Usa `GROQ_API_KEY` + `NEXT_PUBLIC_API_URL` para activar el chatbot IA
- Testea Twilio en ambiente sandbox antes de producción

---

## 🧾 Credenciales de ejemplo

No incluyas credenciales reales en el repositorio. Usa variables de entorno en Vercel/Netlify o `.env.local` en local.

