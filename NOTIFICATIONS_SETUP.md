# Configuración de Notificaciones con Twilio y Vercel Cron

## Sistema de Notificaciones de Pago

El sistema envía recordatorios automáticos a los clientes basados en sus días de pago definidos en cada préstamo.

### Tipos de Notificaciones

1. **3 días antes del pago**: Recordatorio de preparación
2. **1 día antes del pago**: Recordatorio urgente
3. **Día de pago**: Recordatorio del pago del día

Estas notificaciones se envían automáticamente cada día a las 9 AM UTC.

## Pasos de configuración

### 1. Variables de entorno (.env.local)

Agrega las siguientes variables:

```
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Seguridad para Cron Job
CRON_SECRET=your_secret_key

# API URL (para desarrollo local)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2. Obtener credenciales de Twilio

1. Ve a [Twilio Console](https://console.twilio.com)
2. Copia tu Account SID y Auth Token
3. Configura tu número de WhatsApp en Twilio
4. Activa WhatsApp Business API

### 3. Configurar base de datos

La tabla `notifications` y el campo `payment_days` en `loans` ya están en `supabase/schema.sql`.

Aplica las migraciones:

```sql
-- Campo payment_days en tabla loans (ya incluido)
-- Tabla notifications para historial (ya incluida)
```

### 4. Configurar Vercel Cron

El archivo `vercel.json` contiene la configuración:

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-notifications",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Horario**: Se ejecuta diariamente a las 9 AM UTC

### 5. Definir días de pago

Al crear o editar un préstamo, selecciona los días del mes en que el cliente paga (ej: 15, 25, 30).

El sistema automáticamente:
- Envía notificación 3 días antes
- Envía notificación 1 día antes
- Envía notificación el día del pago

### 6. Endpoints disponibles

**GET `/api/notifications`**
- Obtiene el historial de notificaciones

**POST `/api/notifications/send`**
- Envía una notificación manualmente
- Body: `{ loanId, clientId, phone, subject, content, type }`

**GET `/api/cron/payment-notifications`**
- Ejecuta el cron job (solo desde Vercel)
- Header: `Authorization: Bearer {CRON_SECRET}`

### 7. TODOs pendientes

- [ ] Agregar campo `phone` a la tabla `clients` para obtener números reales
- [ ] Conectar números reales de clientes en lugar de placeholders
- [ ] Implementar webhook de Twilio para actualizar status de entrega
- [ ] Agregar templates de mensajes personalizables
- [ ] Implementar reintentos automáticos para mensajes fallidos

### Cómo funciona

1. **Creación de préstamo**: Selecciona los días de pago (ej: 15, 25, 30)
2. **Cron diario**: Se ejecuta a las 9 AM UTC
3. **Lógica**:
   - Obtiene todos los préstamos activos
   - Para cada préstamo, verifica si hoy es un día de notificación (3 antes, 1 antes, o día del pago)
   - Verifica que no se haya enviado esa notificación hoy
   - Envía por WhatsApp a través de Twilio
4. **Registro**: Cada notificación se registra en la tabla `notifications`

