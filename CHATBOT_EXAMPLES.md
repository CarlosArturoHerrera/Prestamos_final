// Ejemplos de uso del Chatbot IA
// Este archivo muestra cómo interactuar con el sistema

// ============================================
// EJEMPLO 1: Consultas de Portafolio
// ============================================

/*
Pregunta al IA: "¿Cuál es el estado actual de mi cartera?"

El sistema:
1. Llama a getPortfolioSummary()
2. Obtiene de Supabase:
   - Total de clientes
   - Total de préstamos
   - Valor total del portafolio
   - Tasa de interés promedio
   - Cantidad de préstamos en mora
   - Cantidad de préstamos en riesgo

3. GROQ responde:
"Tu cartera tiene los siguientes datos:
- Total de Clientes: 45
- Préstamos Activos: 156
- Valor Total: $234,567.89
- Tasa Promedio: 18.5%
- Préstamos en Mora: 12 (7.7%)
- Préstamos en Riesgo: 8 (5.1%)

La cartera se encuentra en buen estado general, 
aunque debes prestar atención a los 12 préstamos en mora."
*/

// ============================================
// EJEMPLO 2: Preguntas sobre Clientes
// ============================================

/*
Pregunta al IA: "Busca al cliente María González"

El sistema:
1. Llama a searchClients("María González")
2. Obtiene de Supabase los clientes que coinciden
3. GROQ responde con información del cliente
4. Puedes hacer clic en 🔊 para escuchar

Respuesta esperada:
"Encontré la siguiente información sobre María González:
- ID: CLI-00456
- Email: maria.gonzalez@email.com
- Teléfono: +56-912345678
- Estado: Activo
- Préstamos Activos: 2
- Valor Total de Deuda: $45,000
- Último Pago: Hace 5 días"
*/

// ============================================
// EJEMPLO 3: Usar Modo Voz
// ============================================

/*
Proceso completo con voz:

1. Presiona el botón 🎤 "Habla con la IA"
2. Hablas: "Muéstrame los préstamos vencidos"
3. El botón cambia a "Escuchando..." (animado)
4. Audio se envía a Eleven Labs para transcribir
5. Sistema recibe: "Muéstrame los préstamos vencidos"
6. Se envía como mensaje al chat
7. GROQ responde con lista de préstamos en mora
8. Haces clic en 🔊 para escuchar la respuesta

Respuesta con voz:
"He encontrado 12 préstamos vencidos:
1. Cliente: Juan Pérez - Monto: $5,000 - Días Vencidos: 15
2. Cliente: Ana García - Monto: $8,500 - Días Vencidos: 22
..."
*/

// ============================================
// EJEMPLO 4: Análisis de Riesgo
// ============================================

/*
Pregunta: "¿Cuáles son mis clientes en riesgo?"

Procesamiento:
1. Sistema consulta Supabase
2. getOverdueLoans() obtiene préstamos en mora
3. getActiveClients() obtiene clientes con issues
4. GROQ analiza los datos y proporciona insights

Respuesta:
"Basado en el análisis de tu portafolio, 
identifico los siguientes clientes de riesgo:

ALTO RIESGO (más de 30 días vencido):
- Carlos López: $12,000 vencido hace 35 días
- Roberto Sánchez: $8,500 vencido hace 42 días

RIESGO MEDIO (15-30 días):
- Sandra Martínez: $6,000 vencido hace 18 días
- Felipe Torres: $9,200 vencido hace 25 días

RECOMENDACIÓN: 
Contactar urgentemente a los clientes de alto riesgo 
y establecer planes de pago."
*/

// ============================================
// EJEMPLO 5: Combinar Voz Entrada y Salida
// ============================================

/*
Flujo completo:

1. Usuario: Presiona 🎤
2. Habla: "¿Cuánto debo cobrar este mes?"
3. Sistema transcribe automáticamente
4. GROQ consulta:
   - getPortfolioSummary()
   - getOverdueLoans()
   - getActiveClients()
5. GROQ responde:
   "Este mes debes cobrar aproximadamente $45,678 
   distribuido en 234 préstamos. Ten en cuenta que 
   12 préstamos están vencidos y requieren atención inmediata."

6. Usuario: Hace clic en 🔊
7. Respuesta se reproduce con voz de Eleven Labs

Ejemplo de voz (female, es-ES):
"Este mes debes cobrar aproximadamente 
cuarenta y cinco mil seiscientos setenta y ocho dólares..."
*/

// ============================================
// FUNCIONES DISPONIBLES EN ai-helpers.ts
// ============================================

/*
import {
  getPortfolioSummary,      // Resumen general de cartera
  getActiveClients,          // Clientes activos
  getOverdueLoans,          // Préstamos vencidos
  getClientDetails,         // Info de cliente específico
  getClientLoans,           // Préstamos de un cliente
  searchClients,            // Buscar clientes
  buildAIContext            // Construir contexto para IA
} from "@/lib/ai-helpers"

// Ejemplos de uso en el backend:

// Obtener resumen
const summary = await getPortfolioSummary()
console.log(`Total portafolio: $${summary.total_portfolio_value}`)

// Buscar cliente
const clients = await searchClients("María")
clients.forEach(c => console.log(c.nombre))

// Obtener préstamos vencidos
const overdue = await getOverdueLoans()
console.log(`Préstamos vencidos: ${overdue.length}`)

// Construir contexto para el IA
const context = await buildAIContext()
// Retorna string con resumen formateado para el system prompt
*/

// ============================================
// FUNCIONES DE VOZ
// ============================================

/*
import {
  generateSpeech,     // Generar audio de texto
  playAudio,          // Reproducir blob de audio
  getSpeechStream     // Stream de audio para respuestas largas
} from "@/lib/text-to-speech"

// Ejemplos:

// Generar y reproducir una frase
const audioBlob = await generateSpeech("Hola, soy tu asistente IA")
await playAudio(audioBlob)

// Para respuestas largas (streaming)
const stream = await getSpeechStream(textoLargo)
if (stream) {
  // Usar ReadableStream para procesar audio en tiempo real
}
*/

// ============================================
// FLUJO DEL CHAT API
// ============================================

/*
POST /api/chat

Request:
{
  "messages": [
    {
      "role": "user",
      "content": "¿Cuál es el estado de mi cartera?"
    }
  ]
}

Procesamiento en route.ts:
1. Recibe mensajes del cliente
2. Llama a buildAIContext() para obtener datos
3. Crea system prompt con contexto
4. Envía a GROQ con Vercel AI SDK
5. GROQ retorna respuesta (streaming)
6. Response es enviado como stream DataStream

Response:
Stream de texto (chunked) que se actualiza en tiempo real
"Tu cartera tiene 12 préstamos activos..."
*/

// ============================================
// INTEGRACIÓN EN COMPONENTE REACT
// ============================================

/*
import { useChat } from "ai/react"

const { 
  messages,          // Array de mensajes [user, assistant]
  input,             // Valor actual del input
  handleInputChange, // Handler para cambios en input
  handleSubmit,      // Handler para enviar mensaje
  isLoading          // Boolean: ¿está esperando respuesta?
} = useChat({
  api: "/api/chat"
})

// Renderizar:
<form onSubmit={handleSubmit}>
  <input 
    value={input}
    onChange={handleInputChange}
    placeholder="Tu pregunta..."
  />
  <button type="submit" disabled={isLoading}>
    Enviar
  </button>
</form>

{messages.map(msg => (
  <div key={msg.id}>
    {msg.role === "assistant" && (
      <button onClick={() => handleSpeakMessage(msg.id, msg.content)}>
        🔊
      </button>
    )}
    {msg.content}
  </div>
))}
*/

// ============================================
// VARIABLES DE ENTORNO NECESARIAS
// ============================================

/*
# En .env.local (ya configuradas)

# AI Services
ELEVEN_LABS_API_KEY=sk_...          # Para TTS y STT
GROQ_API_KEY=gsk_...                # Para chat con IA

# Supabase (base de datos)
SUPABASE_URL=https://...            # URL de Supabase
SUPABASE_ANON_KEY=...               # Clave pública

# NextAuth (no necesario para chat, pero en tu setup)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
*/

// ============================================
// TIPS Y TRUCOS
// ============================================

/*
1. MEJORAR RESPUESTAS:
   - Edita el system prompt en src/app/api/chat/route.ts
   - Añade instrucciones específicas de tu negocio
   - Incluye ejemplos de respuestas esperadas

2. OPTIMIZAR VOSS:
   - Los voice IDs de Eleven Labs están en: https://api.elevenlabs.io/v1/voices
   - Cambia el ID en generateSpeech() para otras voces
   - Ajusta stability y similarity_boost para diferentes tonos

3. DEBUGGEAR:
   - Abre DevTools (F12) → Console
   - Verás logs de los chats en tiempo real
   - Revisa Network tab para ver requests a /api/chat

4. RENDIMIENTO:
   - buildAIContext() se ejecuta en cada mensaje
   - Considera cachear resultados si es muy lento
   - Limita la cantidad de datos en el context

5. SEGURIDAD:
   - No expongas ELEVEN_LABS_API_KEY en el cliente
   - Las consultas a DB pasan por API routes
   - GROQ_API_KEY se mantiene en servidor
*/
