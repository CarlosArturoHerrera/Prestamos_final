/**
 * POST /api/twilio/status
 *
 * Webhook que Twilio llama con actualizaciones de estado de mensajes WhatsApp.
 * Configura este URL como statusCallback en el envío.
 *
 * Twilio envía form-encoded POST con campos:
 *   MessageSid     — SID del mensaje (SM... o MM...)
 *   MessageStatus  — queued | sent | delivered | failed | undelivered | read
 *   ErrorCode      — código de error si aplica (ej: 30008)
 *   ErrorMessage   — descripción del error
 *   To, From       — números del mensaje
 */

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const TERMINAL_STATUSES = ["DELIVERED", "READ", "FAILED", "UNDELIVERED"]

export async function POST(request: Request) {
  const text = await request.text()
  const params = new URLSearchParams(text)

  const sid = params.get("MessageSid")
  const status = params.get("MessageStatus")
  const errorCode = params.get("ErrorCode")
  const errorMessage = params.get("ErrorMessage")

  if (!sid || !status) {
    console.warn("[twilio/status] callback sin MessageSid o MessageStatus", Object.fromEntries(params))
    return NextResponse.json({ error: "Faltan MessageSid o MessageStatus" }, { status: 400 })
  }

  const upperStatus = status.toUpperCase()

  const updatePayload: Record<string, unknown> = {
    estado: upperStatus,
  }

  const isFailed = ["FAILED", "UNDELIVERED"].includes(upperStatus)
  if (isFailed && (errorCode || errorMessage)) {
    updatePayload.error_detalle = [errorMessage, errorCode ? `code=${errorCode}` : null]
      .filter(Boolean)
      .join(" | ")
  }

  console.info("[twilio/status] callback recibido", {
    sid,
    status: upperStatus,
    terminal: TERMINAL_STATUSES.includes(upperStatus),
    errorCode: errorCode ?? null,
    errorMessage: errorMessage ?? null,
  })

  const { error } = await supabase
    .from("notificaciones")
    .update(updatePayload)
    .eq("twilio_message_sid", sid)

  if (error) {
    console.error("[twilio/status] DB update failed", { sid, error: error.message })
    // Devolvemos 200 igual para que Twilio no reintente indefinidamente
    return NextResponse.json({ ok: false, error: error.message })
  }

  return NextResponse.json({ ok: true, sid, status: upperStatus })
}
