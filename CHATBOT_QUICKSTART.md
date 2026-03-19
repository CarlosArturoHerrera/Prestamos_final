# ⚡ Guía Rápida del Chatbot IA

## ✅ Estado: Completamente Funcional

Tu chatbot ya está listo para usar. Aquí está el resumen de lo que se implementó:

---

## 🎯 ¿Qué puedo hacer con este chatbot?

### 💬 Chat Inteligente
- Hacer preguntas sobre tu cartera de préstamos
- Consultar información de clientes
- Analizar métricas y tasas de mora
- Obtener recomendaciones basadas en datos en vivo

### 🎤 Modo Voz (entrada)
- Presiona el botón 🎤 en la esquina inferior
- Habla tu pregunta
- El sistema la transcribe automáticamente

### 🔊 Modo Voz (salida)
- Haz clic en el botón 🔊 en cualquier respuesta
- Escucha la respuesta del IA en español natural

---

## 📦 ¿Qué se instaló?

```bash
✅ ai                      # Vercel AI SDK
✅ @ai-sdk/groq           # Integración GROQ
✅ elevenlabs             # Síntesis de voz
```

---

## 📁 ¿Qué archivos se crearon?

| Archivo | Propósito |
|---------|-----------|
| `src/lib/ai-helpers.ts` | Consultas a Supabase |
| `src/lib/text-to-speech.ts` | Síntesis de voz (TTS) |
| `src/lib/speech-to-text.ts` | Reconocimiento de voz |
| `src/app/api/chat/route.ts` | Endpoint principal |
| `src/components/dashboard/chat-sidebar.tsx` | UI mejorada |

---

## 🚀 Cómo Empezar

### 1. **Abre el chat**
   - El botón flotante de IA está en la esquina inferior izquierda
   - Haz clic en 💫 para abrir el sidebar

### 2. **Haz una pregunta**
   - Escribe: "¿Cuál es el estado de mi cartera?"
   - O presiona 🎤 y habla

### 3. **Escucha la respuesta**
   - Haz clic en 🔊 para escuchar con voz

### 4. **Continúa la conversación**
   - El IA recuerda el contexto
   - Puedes hacer preguntas de seguimiento

---

## 💡 Ejemplos de Preguntas

```
Portafolio:
- "¿Cuántos préstamos tengo activos?"
- "¿Cuál es el valor total de mi cartera?"
- "¿Cuál es la tasa de interés promedio?"

Clientes:
- "Busca al cliente Juan García"
- "¿Cuántos clientes activos tengo?"

Riesgo:
- "¿Cuáles son mis préstamos vencidos?"
- "¿Cuántos están en mora?"

Análisis:
- "¿Qué debo hacer con los préstamos vencidos?"
- "¿Cuál es el porcentaje de mora?"
```

---

## 🔑 Configuración (Ya Hecha)

Las siguientes variables están configuradas en `.env.local`:

```env
ELEVEN_LABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ No necesitas hacer nada, está todo listo.

---

## ⚙️ Cómo Funciona (Internamente)

```
Usuario escribe mensaje
        ↓
POST /api/chat con mensaje
        ↓
Sistema consulta Supabase por datos en vivo
        ↓
Construye "contexto" con información actual
        ↓
Envía mensaje + contexto a GROQ
        ↓
GROQ genera respuesta inteligente
        ↓
Respuesta se muestra en tiempo real (streaming)
        ↓
Usuario puede hacer clic en 🔊 para escuchar
        ↓
Eleven Labs convierte texto a voz
        ↓
Audio se reproduce en navegador
```

---

## 🎨 UI Features

- ✅ Chat limpio y moderno
- ✅ Animación de carga mientras espera respuesta
- ✅ Auto-scroll al final de la conversación
- ✅ Botón de voz flotante
- ✅ Indicador de estado (escuchando/hablando)
- ✅ Respuestas en tiempo real con streaming

---

## 🔧 Personalización Fácil

### Cambiar la voz del IA
Edita `src/lib/text-to-speech.ts` y busca este ID:
```typescript
"https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"
// ^^ Cambia este ID por otro de: https://api.elevenlabs.io/v1/voices
```

### Mejorar respuestas
Edita `src/app/api/chat/route.ts` y ajusta el system prompt:
```typescript
const systemPrompt = `
Eres un experto en gestión de préstamos...
[AÑADE TUS INSTRUCCIONES PERSONALIZADAS AQUÍ]
`
```

### Agregar más datos al contexto
Edita `src/lib/ai-helpers.ts` y añade nuevas funciones:
```typescript
export async function getMisCustomData() {
  // Consulta Supabase lo que necesites
  return datos
}
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| Micrófono no funciona | Permite acceso en navegador (Chrome → Configuración → Privacidad → Micrófono) |
| No hay sonido en voz | Verifica volumen del navegador y que speakers estén conectados |
| Chat no responde | Recarga la página, verifica conexión a internet |
| Errores en consola | Abre F12 → Console, copia error y revisa las claves API |

---

## 📊 Datos Disponibles

El IA tiene acceso a:

```javascript
// Portfolio summary
- total_clients
- total_loans
- total_portfolio_value
- average_interest_rate
- overdue_loans
- at_risk_loans

// Client details
- nombre
- email
- telefono
- estado

// Loan information
- monto
- saldo
- tasa_interes
- estado
- fecha_vencimiento
```

---

## 📚 Documentación Completa

Para más detalles, lee:
- [CHATBOT_SETUP.md](CHATBOT_SETUP.md) - Documentación técnica completa
- [CHATBOT_EXAMPLES.md](CHATBOT_EXAMPLES.md) - Ejemplos de uso y casos prácticos

---

## ✨ Próximas Mejoras (Opcionales)

- [ ] Guardar conversaciones en Supabase
- [ ] Dashboard con historial de chats
- [ ] Alertas automáticas de préstamos vencidos
- [ ] Exportar reportes basados en conversación
- [ ] Integración con WhatsApp o Telegram
- [ ] Análisis predictivo con ML

---

## 🎉 ¡Listo!

Tu chatbot IA está funcional y conectado a tu base de datos.

**Pruébalo ahora:**
1. Abre tu app
2. Haz clic en el botón 💫 de IA en la esquina inferior
3. Pregunta algo sobre tu cartera
4. ¡Disfruta tu asistente inteligente!

---

**Versión**: 1.0  
**Última actualización**: 24 de enero de 2026  
**Estado**: ✅ Completamente Funcional
