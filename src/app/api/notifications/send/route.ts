import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { resolveTwilioWhatsAppFrom, serializeTwilioSendError, toTwilioWhatsAppAddress } from "@/lib/twilio-whatsapp"

export async function POST(request: Request) {
  try {
    const { loanId, clientId, phone, email, subject, content, type } = await request.json()

    if (!loanId || !clientId || !phone || !subject || !content || !type) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 })
    }

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

    if (type === "whatsapp") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
      const fromR = resolveTwilioWhatsAppFrom()

      if (!fromR.ok) {
        await supabase.from("notifications").update({ status: "failed" }).eq("id", notif.id)
        return NextResponse.json({ error: fromR.reason }, { status: 500 })
      }

      if (!accountSid || !authToken) {
        await supabase.from("notifications").update({ status: "failed" }).eq("id", notif.id)
        return NextResponse.json(
          { error: "Twilio: faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN" },
          { status: 500 },
        )
      }

      let toAddr: string
      try {
        toAddr = toTwilioWhatsAppAddress(String(phone))
      } catch (e) {
        await supabase.from("notifications").update({ status: "failed" }).eq("id", notif.id)
        return NextResponse.json({ error: e instanceof Error ? e.message : "Teléfono inválido" }, { status: 400 })
      }

      const bodyText = `${subject}\n\n${content}`
      const bodyPreview = bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText
      console.info("[twilio-whatsapp] preflight (legacy /api/notifications/send)", {
        accountSidPresent: Boolean(accountSid),
        authTokenPresent: Boolean(authToken),
        from: fromR.value,
        to: toAddr,
        bodyLength: bodyText.length,
        bodyPreview,
      })

      try {
        const twilio = (await import("twilio")).default
        const client = twilio(accountSid, authToken)
        await client.messages.create({
          from: fromR.value,
          to: toAddr,
          body: bodyText,
        })

        await supabase
          .from("notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notif.id)

        return NextResponse.json({ ok: true, notification: notif })
      } catch (twilioError) {
        const detail = serializeTwilioSendError(twilioError)
        console.error("[twilio-whatsapp] legacy route error", { from: fromR.value, to: toAddr, detail })
        await supabase.from("notifications").update({ status: "failed" }).eq("id", notif.id)
        return NextResponse.json({ error: detail }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, notification: notif })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 })
  }
}
