import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { construirMensajeReporte, obtenerMorososRepresentante } from "@/lib/cobranza"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notificacionEnviarSchema } from "@/lib/validations/schemas"

async function enviarEmailResend(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!key || !from) {
    return { ok: false, error: "RESEND_API_KEY o RESEND_FROM_EMAIL no configurados" }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { ok: false, error: err }
  }
  return { ok: true }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = notificacionEnviarSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { representanteIds, enviarATodos, canal, vistaPrevia } = parsed.data

  let repsQuery = supabase.from("representantes").select("*")

  if (enviarATodos) {
    /* todos */
  } else {
    repsQuery = repsQuery.in("id", representanteIds ?? [])
  }

  const { data: representantes, error: re } = await repsQuery

  if (re) {
    return NextResponse.json({ error: re.message }, { status: 400 })
  }

  const resultados: unknown[] = []

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER

  let twilioClient: ReturnType<typeof import("twilio")> | null = null
  if (canal === "WHATSAPP" || canal === "AMBOS") {
    if (accountSid && authToken) {
      const twilio = (await import("twilio")).default
      twilioClient = twilio(accountSid, authToken)
    }
  }

  for (const rep of representantes ?? []) {
    const { lineas, total_cartera_mora } = await obtenerMorososRepresentante(supabase, rep.id)
    const nombreRep = `${rep.nombre} ${rep.apellido}`
    const mensaje = construirMensajeReporte(nombreRep, lineas, total_cartera_mora)

    const clientesJson = lineas.map((l) => ({
      cliente_id: l.cliente_id,
      prestamo_id: l.prestamo_id,
      nombre: l.nombre_completo,
      cedula: l.cedula,
      monto_pendiente: l.monto_pendiente,
      dias_atraso: l.dias_atraso,
      ultimo_pago: l.ultimo_pago,
    }))

    if (vistaPrevia) {
      resultados.push({
        representante_id: rep.id,
        mensaje,
        clientes_incluidos: clientesJson,
      })
      continue
    }

    const enviarWa = canal === "WHATSAPP" || canal === "AMBOS"
    const enviarEm = canal === "EMAIL" || canal === "AMBOS"

    const errores: string[] = []
    let waOk = false
    let emOk = false

    if (enviarWa) {
      if (!twilioClient || !whatsappFrom) {
        errores.push("Twilio no configurado")
      } else {
        try {
          const rawTo = String(rep.telefono).replace(/\s/g, "")
          const toNum = rawTo.startsWith("whatsapp:") ? rawTo : `whatsapp:${rawTo}`
          const fromNum = whatsappFrom.startsWith("whatsapp:")
            ? whatsappFrom
            : `whatsapp:${whatsappFrom.replace(/^\+?/, "+")}`

          await twilioClient.messages.create({
            from: fromNum,
            to: toNum,
            body: mensaje,
          })
          waOk = true
        } catch (e) {
          errores.push(e instanceof Error ? e.message : "Error WhatsApp")
        }
      }
    }

    if (enviarEm) {
      const r = await enviarEmailResend(rep.email, "Reporte de mora — cartera", mensaje)
      if (r.ok) {
        emOk = true
      } else {
        errores.push(r.error ?? "Error email")
      }
    }

    const algunoOk = waOk || emOk
    const estado: "ENVIADO" | "ERROR" = algunoOk ? "ENVIADO" : "ERROR"
    const errorDetalle = errores.length ? errores.join(" | ") : null

    const { data: ins, error: insE } = await supabase
      .from("notificaciones")
      .insert({
        representante_id: rep.id,
        canal,
        mensaje,
        clientes_incluidos: clientesJson,
        fecha_envio: new Date().toISOString(),
        estado,
        error_detalle: errorDetalle,
      })
      .select()
      .single()

    if (insE) {
      resultados.push({ representante_id: rep.id, error: insE.message })
    } else {
      resultados.push(ins)
    }
  }

  return NextResponse.json({ data: resultados })
}
