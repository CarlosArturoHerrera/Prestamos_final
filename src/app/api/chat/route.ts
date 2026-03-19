import { groq } from "@ai-sdk/groq"
import { streamText } from "ai"
import { buildAIContext, searchClients, getClientLoans, getPortfolioSummary } from "@/lib/ai-helpers"
import { MEGA_SYSTEM_PROMPT } from "@/lib/mega-system-prompt"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!process.env.GROQ_API_KEY) {
      return new Response("Missing GROQ_API_KEY", { status: 400 })
    }

    // Construir contexto con datos de la base de datos
    const dbContext = await buildAIContext()

    // Combinar mega system prompt con contexto en tiempo real de la BD
    const systemPrompt = `${MEGA_SYSTEM_PROMPT}

## DATOS EN TIEMPO REAL DE TU CARTERA

${dbContext}

---

Usa esta información en tiempo real para responder preguntas específicas sobre la cartera actual del usuario.`

    // Stream de la respuesta usando Vercel AI SDK
    const result = streamText({
      model: groq("llama-3.1-8b-instant"),
      system: systemPrompt,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("Error in chat route:", error)
    return new Response("Error processing request", { status: 500 })
  }
}
