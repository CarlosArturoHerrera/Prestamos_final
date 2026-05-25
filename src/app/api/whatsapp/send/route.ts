/**
 * POST /api/whatsapp/send
 *
 * Endpoint seguro para enviar un mensaje WhatsApp a cualquier número.
 * Solo accesible desde el servidor (no expone claves de Twilio al frontend).
 *
 * Body:
 *   { "phone": "+18091234567", "message": "Hola desde Elicar" }
 *
 * Respuestas:
 *   200  { ok: true, sid, to, from }
 *   400  { ok: false, error: "..." }   — validación / teléfono inválido
 *   500  { ok: false, error: "..." }   — error de Twilio o config faltante
 */

import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/twilio-whatsapp"

export async function POST(request: Request) {
  // ── Autenticación: solo usuarios logueados pueden usar este endpoint ──
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  // ── Parsear body ──
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  const { phone, message } = (body ?? {}) as Record<string, unknown>

  // ── Validaciones de entrada ──
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json(
      { ok: false, error: "El campo 'phone' es requerido y debe ser una cadena no vacía" },
      { status: 400 },
    )
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { ok: false, error: "El campo 'message' es requerido y debe ser una cadena no vacía" },
      { status: 400 },
    )
  }

  // ── Enviar ──
  const result = await sendWhatsAppMessage({ to: phone, message })

  if (!result.ok) {
    const isConfigError =
      result.reason.includes("TWILIO_") ||
      result.reason.includes("Faltan variables")
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: isConfigError ? 500 : 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    to: result.to,
    from: result.from,
  })
}
