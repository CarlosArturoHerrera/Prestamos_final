/**
 * POST /api/twilio/status
 *
 * Webhook que Twilio llama con actualizaciones de estado de mensajes WhatsApp.
 * Configura este URL como statusCallback en el envío.
 *
 * Twilio envía form-encoded POST con campos:
 *   MessageSid            — SID del mensaje (SM... o MM...)
 *   MessageStatus         — queued | sent | delivered | failed | undelivered | read
 *   ErrorCode             — código de error si aplica (ej: 63051)
 *   ErrorMessage          — descripción del error
 *   ChannelStatusMessage  — mensaje detallado del canal (WhatsApp Business)
 *   To, From              — números del mensaje
 */

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const ERROR_MESSAGES: Record<string, string> = {
  "63051": "WhatsApp Sender o cuenta bloqueada (código 63051). Revisar estado en Twilio y Meta Business.",
  "63016": "Twilio no encontró el canal From. Verificar TWILIO_WHATSAPP_FROM en Vercel.",
  "63003": "Canal WhatsApp no habilitado para este número. Revisar configuración en Twilio.",
  "30008": "Mensaje no entregado por el operador. El destinatario puede no tener WhatsApp activo.",
}

function buildErrorDetalle(errorCode: string | null, errorMessage: string | null, channelMsg: string | null): string | null {
  const parts: string[] = []
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    parts.push(ERROR_MESSAGES[errorCode])
  } else if (errorMessage) {
    parts.push(errorMessage)
  }
  if (errorCode) parts.push(`code=${errorCode}`)
  if (channelMsg && channelMsg !== errorMessage) parts.push(channelMsg)
  return parts.length ? parts.join(" | ") : null
}

export async function POST(request: Request) {
  const text = await request.text()
  const params = new URLSearchParams(text)

  const sid = params.get("MessageSid")
  const status = params.get("MessageStatus")
  const errorCode = params.get("ErrorCode")
  const errorMessage = params.get("ErrorMessage")
  const channelStatusMessage = params.get("ChannelStatusMessage")

  if (!sid || !status) {
    console.warn("[twilio/status] callback sin MessageSid o MessageStatus", Object.fromEntries(params))
    return NextResponse.json({ error: "Faltan MessageSid o MessageStatus" }, { status: 400 })
  }

  const upperStatus = status.toUpperCase()
  const isFailed = ["FAILED", "UNDELIVERED"].includes(upperStatus)

  const updatePayload: Record<string, unknown> = {
    estado: upperStatus,
  }

  // Guardar error_detalle para cualquier código de error, no solo FAILED
  const errorDetalle = buildErrorDetalle(errorCode, errorMessage, channelStatusMessage)
  if (errorDetalle) {
    updatePayload.error_detalle = errorDetalle
  }

  console.info("[twilio/status] callback recibido", {
    sid,
    status: upperStatus,
    isFailed,
    errorCode: errorCode ?? null,
    errorMessage: errorMessage ?? null,
    channelStatusMessage: channelStatusMessage ?? null,
    errorDetalle,
  })

  const { error } = await supabase
    .from("notificaciones")
    .update(updatePayload)
    .eq("twilio_message_sid", sid)

  if (error) {
    console.error("[twilio/status] DB update failed", { sid, error: error.message })
    // Respondemos 200 para que Twilio no reintente indefinidamente
    return NextResponse.json({ ok: false, dbError: error.message })
  }

  return NextResponse.json({ ok: true, sid, status: upperStatus })
}
