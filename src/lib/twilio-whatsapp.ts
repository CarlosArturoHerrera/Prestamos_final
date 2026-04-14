/**
 * Normalización y helpers para envío WhatsApp vía Twilio (Messaging API).
 * Sandbox: from típico `whatsapp:+14155238886`.
 */

const WHATSAPP_PREFIX = "whatsapp:"

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "")
}

/**
 * Convierte un teléfono “humano” a E.164 con + (heurística NANP para 10 dígitos).
 */
export function normalizeToE164(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Teléfono vacío")
  }

  if (trimmed.toLowerCase().startsWith(WHATSAPP_PREFIX)) {
    const inner = trimmed.slice(WHATSAPP_PREFIX.length).trim()
    return normalizeToE164(inner)
  }

  const hasPlus = trimmed.startsWith("+")
  const digits = onlyDigits(trimmed)

  if (!digits) {
    throw new Error("Teléfono sin dígitos válidos")
  }

  if (hasPlus) {
    return `+${digits}`
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`
  }

  return `+${digits}`
}

/**
 * Dirección Twilio para WhatsApp: `whatsapp:+E164`.
 */
export function toTwilioWhatsAppAddress(raw: string): string {
  const e164 = normalizeToE164(raw)
  if (!e164.startsWith("+") || e164.length < 8) {
    throw new Error(`E.164 inválido tras normalizar: ${e164}`)
  }
  return `${WHATSAPP_PREFIX}${e164}`
}

export type ResolveTwilioFromResult =
  | { ok: true; value: string; usedLegacyEnv: boolean }
  | { ok: false; reason: string }

/**
 * Remitente WhatsApp: TWILIO_WHATSAPP_FROM obligatorio para nuevos despliegues;
 * si falta, se acepta TWILIO_WHATSAPP_NUMBER (deprecado) con aviso en consola.
 */
export function resolveTwilioWhatsAppFrom(): ResolveTwilioFromResult {
  const primary = process.env.TWILIO_WHATSAPP_FROM?.trim()
  const legacy = process.env.TWILIO_WHATSAPP_NUMBER?.trim()

  if (primary) {
    try {
      return { ok: true, value: toTwilioWhatsAppAddress(primary), usedLegacyEnv: false }
    } catch {
      return { ok: false, reason: "TWILIO_WHATSAPP_FROM tiene un valor inválido" }
    }
  }

  if (legacy) {
    console.warn(
      "[twilio-whatsapp] TWILIO_WHATSAPP_NUMBER está deprecado; define TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 (sandbox) o tu remitente aprobado.",
    )
    try {
      return { ok: true, value: toTwilioWhatsAppAddress(legacy), usedLegacyEnv: true }
    } catch {
      return { ok: false, reason: "TWILIO_WHATSAPP_FROM no configurado y TWILIO_WHATSAPP_NUMBER es inválido" }
    }
  }

  return { ok: false, reason: "TWILIO_WHATSAPP_FROM no configurado" }
}

export function serializeTwilioSendError(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    const parts: string[] = []
    if (typeof o.message === "string" && o.message) parts.push(o.message)
    if (o.code !== undefined && o.code !== null) parts.push(`code=${String(o.code)}`)
    if (typeof o.moreInfo === "string" && o.moreInfo) parts.push(`moreInfo=${o.moreInfo}`)
    if (typeof o.status === "number") parts.push(`http=${String(o.status)}`)
    if (parts.length) return parts.join(" | ")
  }
  if (err instanceof Error) return err.message
  return String(err)
}
