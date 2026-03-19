# APIs para Postman – Prestamos App

**Base URL (local):** `http://localhost:3000`

Asegúrate de tener la app corriendo (`npm run dev`) antes de probar en Postman.

---

## Clientes

### Listar clientes
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/clients`
- **Query params (opcional):**
  - `search` – Buscar por nombre de cliente o segmento

**Ejemplo:** `GET http://localhost:3000/api/clients?search=maria`

---

### Crear cliente
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/clients/create`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "name": "Juan Pérez",
  "phone": "8095551234",
  "email": "juan@email.com",
  "segment": "Premium",
  "location": "Santo Domingo",
  "notes": "Cliente referido"
}
```
- **Requeridos:** `name`, `phone`. El resto son opcionales.

---

### Actualizar cliente
- **Método:** `PUT`
- **URL:** `{{baseUrl}}/api/clients/update`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "id": 1,
  "name": "Juan Pérez",
  "phone": "8095551234",
  "email": "juan@email.com",
  "segment": "Premium",
  "location": "Santo Domingo",
  "notes": "Notas actualizadas"
}
```
- **Requeridos:** `id`, `name`, `phone`.

---

## Segmentos

### Listar segmentos
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/segments`

Devuelve lista de segmentos (`id`, `name`).

---

## Préstamos (Loans)

### Listar préstamos
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/loans`
- **Query params (opcional):**
  - `search` – Buscar por nombre del cliente

**Ejemplo:** `GET http://localhost:3000/api/loans?search=Juan`

---

### Crear préstamo
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/loans/create`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "clientId": "uuid-del-cliente",
  "amount": 50000,
  "rate": 12,
  "termMonths": 12,
  "status": "activo",
  "startDate": "2025-03-17",
  "paymentDays": ["15", "30"]
}
```
- **Requeridos:** `clientId`, `amount`, `rate`, `termMonths`, `status`, `startDate`.  
- **Opcional:** `id` (si no se envía se genera uno tipo `PR-{timestamp}`).  
- **Opcional:** `paymentDays` (por defecto `["15", "30"]`).

---

### Actualizar préstamo
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/loans/update`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "id": "PR-1234567890",
  "amount": 60000,
  "rate": 10,
  "termMonths": 18,
  "status": "aprobado",
  "startDate": "2025-03-17",
  "paymentDays": ["15", "30"]
}
```
- **Requeridos:** `id`, `amount`, `rate`, `termMonths`, `status`, `startDate`.

---

### Eliminar préstamo (soft delete)
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/loans/delete`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "loanId": "PR-1234567890"
}
```

---

## Notificaciones

### Listar notificaciones
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/notifications`

---

### Enviar notificación
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/notifications/send`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "loanId": "PR-1234567890",
  "clientId": "uuid-del-cliente",
  "phone": "+18095551234",
  "subject": "Recordatorio de pago",
  "content": "Tu cuota vence el 15 de marzo.",
  "type": "whatsapp"
}
```
- **Requeridos:** `loanId`, `clientId`, `phone`, `subject`, `content`, `type`.  
- Para WhatsApp real necesitas Twilio configurado (variables de entorno).

---

## Dashboard

### Clientes por segmento
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/clients-segment`

---

### Préstamos por segmento
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/loans-segment`

---

### Notificaciones por segmento
- **Método:** `GET`
- **URL:** `{{baseUrl}}/api/dashboard/notifications-segment`

---

## Chat (IA)

### Chat con el asistente
- **Método:** `POST`
- **URL:** `{{baseUrl}}/api/chat`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "messages": [
    { "role": "user", "content": "¿Cuántos préstamos activos hay?" }
  ]
}
```
- Requiere `GROQ_API_KEY` en variables de entorno. La respuesta es un stream de texto.

---

## Resumen rápido para Postman

| Método | Endpoint |
|--------|----------|
| GET | `/api/clients?search=` |
| POST | `/api/clients/create` |
| PUT | `/api/clients/update` |
| GET | `/api/segments` |
| GET | `/api/loans?search=` |
| POST | `/api/loans/create` |
| POST | `/api/loans/update` |
| POST | `/api/loans/delete` |
| GET | `/api/notifications` |
| POST | `/api/notifications/send` |
| GET | `/api/dashboard/clients-segment` |
| GET | `/api/dashboard/loans-segment` |
| GET | `/api/dashboard/notifications-segment` |
| POST | `/api/chat` |

Crea en Postman una variable de entorno `baseUrl` = `http://localhost:3000` y usa `{{baseUrl}}` en las URLs.
