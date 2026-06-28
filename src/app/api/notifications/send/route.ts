/**
 * POST /api/notifications/send
 *
 * Route legada usada por los cron jobs. Envía un mensaje WhatsApp y
 * registra el resultado en la tabla `notifications`.
 *
 * Autenticación: usa API Key de Twilio (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET).
 * No usa TWILIO_AUTH_TOKEN.
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  sendWhatsAppMessage,
  serializeTwilioSendError,
} from "@/lib/twilio-whatsapp";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { loanId, clientId, phone, email, subject, content, type } =
    body as Record<string, unknown>;

  if (!loanId || !clientId || !phone || !subject || !content || !type) {
    return NextResponse.json(
      {
        error:
          "Campos requeridos: loanId, clientId, phone, subject, content, type",
      },
      { status: 400 },
    );
  }

  // Validación temprana: teléfono no puede estar vacío
  const phoneStr = String(phone).trim();
  if (!phoneStr) {
    return NextResponse.json(
      { error: "El teléfono del cliente está vacío" },
      { status: 400 },
    );
  }

  // Registrar notificación como pendiente
  const { data: notif, error: dbError } = await supabase
    .from("notifications")
    .insert({
      loan_id: loanId,
      client_id: clientId,
      type: "whatsapp",
      phone_or_email: phoneStr,
      subject,
      content,
      notification_type: type,
      status: "pending",
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  if (String(type) === "whatsapp") {
    const messageBody = `${String(subject)}\n\n${String(content)}`;

    const result = await sendWhatsAppMessage({
      to: phoneStr,
      message: messageBody,
    });

    if (!result.ok) {
      console.error("[notifications/send] sendWhatsAppMessage falló", {
        phone: phoneStr,
        reason: result.reason,
      });
      await supabase
        .from("notifications")
        .update({ status: "failed", error_detail: result.reason })
        .eq("id", notif.id);

      const isConfigError =
        result.reason.includes("TWILIO_") ||
        result.reason.includes("Faltan variables");
      return NextResponse.json(
        { error: result.reason },
        { status: isConfigError ? 500 : 400 },
      );
    }

    console.info("[notifications/send] enviado", {
      sid: result.sid,
      to: result.to,
      from: result.from,
    });

    await supabase
      .from("notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        twilio_message_sid: result.sid,
      })
      .eq("id", notif.id);

    return NextResponse.json({
      ok: true,
      notification: notif,
      sid: result.sid,
    });
  }

  // Canal distinto a whatsapp (email, etc.) — no se procesa aquí
  return NextResponse.json({ ok: true, notification: notif });
}
