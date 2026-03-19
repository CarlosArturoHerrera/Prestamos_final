import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const twilio = require("twilio")

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

const client = twilio(accountSid, authToken)

export async function POST(request: Request) {
  try {
    const { loanId, clientId, phone, email, subject, content, type } = await request.json()

    if (!loanId || !clientId || !phone || !subject || !content || !type) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 })
    }

    // Crear registro de notificación
    const { data: notif, error: dbError } = await supabase
      .from("notifications")
      .insert({
        loan_id: loanId,
        client_id: clientId,
        type: "whatsapp",
        phone_or_email: phone,
        subject,
        content,
        notification_type: type,
        status: "pending",
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // Enviar por WhatsApp si el tipo es whatsapp
    if (type === "whatsapp" && whatsappNumber) {
      try {
        const message = await client.messages.create({
          from: `whatsapp:${whatsappNumber}`,
          to: `whatsapp:${phone}`,
          body: `${subject}\n\n${content}`,
        })

        // Actualizar estado a enviado
        await supabase
          .from("notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notif.id)

        return NextResponse.json({ ok: true, notification: notif })
      } catch (twilioError) {
        console.error("Twilio error:", twilioError)
        await supabase
          .from("notifications")
          .update({ status: "failed" })
          .eq("id", notif.id)
        return NextResponse.json({ error: "Error enviando mensaje" }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, notification: notif })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 })
  }
}
