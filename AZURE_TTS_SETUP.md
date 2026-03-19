# Configuración de Azure Speech Service (TTS)

> **Servicio Actual:** Azure Speech Services para Text-to-Speech
> **Free Tier:** 5 millones de caracteres/mes (mejor que Web Speech API)

## ✅ Por Qué Azure Speech Services

| Aspecto | Azure | Web Speech API | Google Cloud |
|--------|-------|-----------------|--------------|
| **Costo** | $4/1M chars | Gratis | $16/1M chars |
| **Free Tier** | 5M chars/mes | ∞ | 1M chars/mes |
| **Calidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Voces ES** | 400+ | 3-5 | 50+ |
| **SSML Support** | ✅ | ❌ | ✅ |
| **Control Prosodia** | ✅ | ❌ | ✅ |
| **Offline** | ❌ | ✅ | ❌ |

**Azure gana en:** Calidad, free tier, voces, control fino
**Web Speech API gana en:** Gratuidad total, offline, cero API keys

---

## 🚀 Configuración de Azure

### Paso 1: Crear Cuenta de Azure

1. Ir a https://portal.azure.com
2. Crear una cuenta gratuita (incluye $200 crédito de prueba)
3. Verificar identidad con tarjeta (no se cobrará)

### Paso 2: Crear Speech Services Resource

1. En Azure Portal, buscar "Speech Services"
2. Click en "Create"
3. Configurar:
   - **Resource Group:** Crear nuevo (ej: "erp-prestamos")
   - **Region:** `eastus`, `westeurope`, `southeastasia` (elige cercana)
   - **Name:** `erp-prestamos-speech`
   - **Pricing Tier:** `Free F0` (5M chars/mes) o `Standard S0`

4. Click "Review + Create" → "Create"

### Paso 3: Obtener Credenciales

1. Una vez creado, ir a "Keys and Endpoint"
2. Copiar:
   - **API Key 1** → `AZURE_SPEECH_KEY`
   - **Region** → `AZURE_SPEECH_REGION` (ej: `eastus`)

### Paso 4: Agregar a .env.local

```bash
AZURE_SPEECH_KEY=tu-api-key-de-azure
AZURE_SPEECH_REGION=eastus
```

### Paso 5: Reiniciar servidor

```bash
bun run dev
```

Prueba: Click en el botón speaker en cualquier mensaje del chat.

---

## 🎤 Voces Disponibles en Español

### Voces Españolas (es-ES)

- **ElviraNeural** (Mujer, default)
  - Edad: Adulto
  - Emoción: Neutra, profesional
  - Ideal para: Asistentes, presentaciones

- **AlvaroNeural** (Hombre)
  - Edad: Adulto
  - Emoción: Neutra, cálido
  - Ideal para: Conversación, narrativa

### Ejemplo de uso

```typescript
// Cambiar voz a hombre
await fetch("/api/text-to-speech", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hola, soy un agente de préstamos",
    voiceGender: "male"  // AlvaroNeural
  }),
})
```

---

## 🎚️ Control de Prosodia (SSML)

La API de Azure soporta SSML para control fino:

```xml
<speak version='1.0' xml:lang='es-ES'>
  <voice name='es-ES-ElviraNeural'>
    <prosody rate='0.95' pitch='1.0'>
      Texto a reproducir con control fino
    </prosody>
  </voice>
</speak>
```

**Parámetros:**
- `rate`: Velocidad (0.5-2.0, default: 1.0)
- `pitch`: Tono (0.5-2.0, default: 1.0)
- `volume`: Volumen (0.0-2.0, default: 1.0)

---

## 💰 Estimado de Costos

### Free Tier (5M caracteres/mes)

| Uso Mensual | Costo |
|-----------|-------|
| 5M chars | $0 |
| 10M chars | $20 (~$4/1M) |
| 20M chars | $60 |
| 50M chars | $180 |

**Para la mayoría de aplicaciones small-medium:** Free tier es suficiente

### Cálculo para tu app

Asumiendo 500 usuarios activos:
- ~100 mensajes de chat/mes por usuario
- ~200 chars por respuesta del AI
- ~20 palabras "spoken" (promedio)

```
500 usuarios × 100 mensajes/mes × 200 chars = 10M chars/mes
Costo: $20/mes (o $0 con free tier inicial)
```

---

## 🔧 Troubleshooting

### "Azure Speech Service not configured"

**Error:** El servidor no encuentra `AZURE_SPEECH_KEY`

**Solución:**
1. Verificar `.env.local` tiene `AZURE_SPEECH_KEY=...`
2. Reiniciar servidor: `bun run dev`
3. Verificar que no hay espacios en blanco

### "403 Forbidden"

**Error:** API Key inválida o región incorrecta

**Solución:**
1. Verificar que copiaste correctamente el API Key
2. Verificar que la región es válida (ej: `eastus`)
3. Ir a Azure Portal y copiar nuevamente

### "Audio no se reproduce"

**Error:** El navegador no puede reproducir el audio

**Solución:**
1. Abrir DevTools (F12) → Console
2. Verificar que no hay errores CORS
3. Verificar que el navegador tiene permisos de audio
4. Intentar con navegador diferente (Chrome, Firefox, Edge)

### "Cuota excedida"

**Error:** Superaste los 5M chars del free tier

**Solución:**
1. Esperar al próximo mes (se resetea)
2. Actualizar a `Standard S0` ($4/1M chars adicional)
3. Implementar caché de audio para respuestas comunes

---

## 📊 Monitoreo de Uso

### Desde Azure Portal

1. Ir a tu Speech Services resource
2. → "Monitoring" → "Metrics"
3. Seleccionar:
   - **Metric:** "Count of Speech Synthesis Processing"
   - **Aggregation:** "Sum"
   - **Time Range:** "Last 30 days"

### Configurar Alertas

1. → "Alerts" → "Create"
2. Configurar:
   - **Condition:** "Count > 5000000" (5M chars)
   - **Action:** "Send email notification"

---

## ✅ Checklist de Implementación

- [ ] Crear cuenta de Azure
- [ ] Crear Speech Services resource
- [ ] Copiar API Key y Region
- [ ] Agregar a `.env.local`
- [ ] Reiniciar servidor (`bun run dev`)
- [ ] Test: Click en speaker en un mensaje
- [ ] Verificar que el audio se reproduce
- [ ] (Opcional) Configurar alertas en Azure Portal
- [ ] (Opcional) Monitorear uso mensual

---

## 🔄 Migración desde Web Speech API

Si antes usabas Web Speech API nativo:

**Antes (Web Speech API):**
```typescript
const utterance = new SpeechSynthesisUtterance(text)
utterance.lang = 'es-ES'
speechSynthesis.speak(utterance)
```

**Ahora (Azure TTS):**
```typescript
const response = await fetch("/api/text-to-speech", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, voiceGender: "female" }),
})
const audio = new Audio(URL.createObjectURL(
  new Blob([await response.arrayBuffer()], { type: "audio/mpeg" })
))
audio.play()
```

**Cambios en el código:**
- El componente `chat-sidebar.tsx` ya está actualizado
- No requiere cambios adicionales en tu código
- El endpoint `/api/text-to-speech` maneja todo

---

## 🌍 Regiones de Azure Disponibles

Elige la más cercana a tu ubicación:

| Región | Código | Casos de Uso |
|--------|--------|------------|
| **East US** | eastus | USA, Latinoamérica |
| **West Europe** | westeurope | Europa, España |
| **Southeast Asia** | southeastasia | Asia, Pacífico |
| **Canada Central** | canadacentral | Canadá |
| **UK South** | uksouth | Reino Unido |

---

## 💡 Tips de Optimización

### 1. Caché de Audio

Para respuestas frecuentes (ej: "Hola, ¿cómo estás?"):

```typescript
const cache = new Map<string, ArrayBuffer>()

const response = await fetch("/api/text-to-speech", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text }),
})
cache.set(text, await response.arrayBuffer())
```

### 2. Compresión de Texto

Si tienes respuestas muy largas:

```typescript
const text = longResponse.split('.').slice(0, 5).join('.')
// Habla solo los primeros 5 párrafos
```

### 3. Usar voces diferentes según contexto

```typescript
// Errores: voz masculina más seria
const voiceGender = isError ? "male" : "female"
```

---

## 📚 Enlaces Útiles

- [Azure Speech Services Docs](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- [SSML Reference](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/speech-synthesis-markup)
- [Precios de Azure Speech](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- [Probar voces online](https://speech.microsoft.com/portal/tts-synthesis)

---

**¿Necesitas ayuda?** Revisar sección "Troubleshooting" arriba o crear un issue en GitHub.
