/**
 * Servicio de WhatsApp vía Twilio — autenticación por API Key (no AuthToken).
 *
 * Variables de entorno requeridas (server-side únicamente):
 *   TWILIO_ACCOUNT_SID     — ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_API_KEY_SID     — SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_API_KEY_SECRET  — secreto de la API Key
 *   TWILIO_WHATSAPP_FROM   — whatsapp:+18099421913 (número aprobado)
 */

const WHATSAPP_PREFIX = "whatsapp:"

// ─── Resolución del template de mora ──────────────────────────────────────────

export type ResolveMoraTemplateResult =
  | { ok: true; sid: string }
  | { ok: false; reason: string }

/**
 * Lee TWILIO_MORA_TEMPLATE_SID y valida su formato.
 * Los Content Template SIDs de Twilio empiezan con "HX".
 */
export function resolveMoraTemplateSid(): ResolveMoraTemplateResult {
  const sid = process.env.TWILIO_MORA_TEMPLATE_SID?.trim()
  if (!sid) {
    return { ok: false, reason: "TWILIO_MORA_TEMPLATE_SID no configurado en variables de entorno" }
  }
  if (!sid.startsWith("HX")) {
    return { ok: false, reason: `TWILIO_MORA_TEMPLATE_SID inválido (debe empezar con HX): ${sid}` }
  }
  return { ok: true, sid }
}

// ─── Normalización de teléfonos ───────────────────────────────────────────────

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "")
}

/**
 * Convierte un número "humano" a formato E.164 con + delante.
 * Heurística NANP (República Dominicana y EEUU):
 *   809XXXXXXX / 829XXXXXXX / 849XXXXXXX (10 dígitos) → +1XXXXXXXXXX
 *   1XXXXXXXXXX (11 dígitos empezando en 1)            → +1XXXXXXXXXX
 *   Ya tiene + → respeta los dígitos tal cual
 */
export function normalizeToE164(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error("Teléfono vacío")

  // Si viene con prefijo whatsapp: lo quitamos y reintentamos
  if (trimmed.toLowerCase().startsWith(WHATSAPP_PREFIX)) {
    return normalizeToE164(trimmed.slice(WHATSAPP_PREFIX.length).trim())
  }

  const hasPlus = trimmed.startsWith("+")
  const digits = onlyDigits(trimmed)

  if (!digits) throw new Error("Teléfono sin dígitos válidos")

  // Ya tiene + → confiamos en que es E.164 correcto
  if (hasPlus) return `+${digits}`

  // 10 dígitos → NANP sin código de país → +1XXXXXXXXXX
  if (digits.length === 10) return `+1${digits}`

  // 11 dígitos empezando en 1 → +1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`

  // Cualquier otro caso: añadimos + como está
  return `+${digits}`
}

/**
 * Construye la dirección Twilio WhatsApp: `whatsapp:+E164`
 */
export function toTwilioWhatsAppAddress(raw: string): string {
  const e164 = normalizeToE164(raw)
  if (!e164.startsWith("+") || e164.length < 8) {
    throw new Error(`Número E.164 inválido tras normalizar: ${e164}`)
  }
  return `${WHATSAPP_PREFIX}${e164}`
}

// ─── Resolución del remitente ─────────────────────────────────────────────────

export type ResolveTwilioFromResult =
  | { ok: true; value: string }
  | { ok: false; reason: string }

/**
 * Lee TWILIO_WHATSAPP_FROM y lo normaliza a `whatsapp:+E164`.
 * Si no está configurado devuelve `{ ok: false, reason }`.
 */
export function resolveTwilioWhatsAppFrom(): ResolveTwilioFromResult {
  const raw = process.env.TWILIO_WHATSAPP_FROM?.trim()

  if (!raw) {
    return { ok: false, reason: "TWILIO_WHATSAPP_FROM no está configurado" }
  }

  try {
    return { ok: true, value: toTwilioWhatsAppAddress(raw) }
  } catch {
    return { ok: false, reason: "TWILIO_WHATSAPP_FROM tiene un valor inválido" }
  }
}

// ─── Cliente Twilio (API Key, no AuthToken) ────────────────────────────────────

export type TwilioClientResult =
  | { ok: true; accountSid: string; apiKeySid: string; apiKeySecret: string }
  | { ok: false; reason: string }

/**
 * Valida que las variables de entorno de Twilio estén presentes y devuelve
 * las credenciales listas para crear el cliente.
 * Usa TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (NO TWILIO_AUTH_TOKEN).
 */
export function getTwilioCredentials(): TwilioClientResult {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()

  const missing: string[] = []
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID")
  if (!apiKeySid) missing.push("TWILIO_API_KEY_SID")
  if (!apiKeySecret) missing.push("TWILIO_API_KEY_SECRET")

  if (missing.length > 0) {
    return { ok: false, reason: `Faltan variables de entorno: ${missing.join(", ")}` }
  }

  return { ok: true, accountSid: accountSid!, apiKeySid: apiKeySid!, apiKeySecret: apiKeySecret! }
}

/**
 * Crea y devuelve un cliente Twilio autenticado con API Key + Secret.
 *
 * Uso:
 *   const result = await createTwilioClient()
 *   if (!result.ok) { ... }
 *   await result.client.messages.create({ ... })
 */
export async function createTwilioClient() {
  const creds = getTwilioCredentials()
  if (!creds.ok) return creds

  const twilio = (await import("twilio")).default
  const client = twilio(creds.apiKeySid, creds.apiKeySecret, {
    accountSid: creds.accountSid,
  })

  return { ok: true as const, client }
}

// ─── Función principal reutilizable ───────────────────────────────────────────

export type SendWhatsAppResult =
  | { ok: true; sid: string; to: string; from: string }
  | { ok: false; reason: string }

/**
 * Envía un mensaje de WhatsApp al número indicado.
 *
 * @param to      Teléfono del destinatario (cualquier formato: 8091234567,
 *                +18091234567, whatsapp:+18091234567, etc.)
 * @param message Cuerpo del mensaje (no puede estar vacío)
 */
export async function sendWhatsAppMessage({
  to,
  message,
}: {
  to: string
  message: string
}): Promise<SendWhatsAppResult> {
  // 1. Validar mensaje
  if (!message.trim()) {
    return { ok: false, reason: "El mensaje no puede estar vacío" }
  }

  // 2. Resolver remitente
  const fromResult = resolveTwilioWhatsAppFrom()
  if (!fromResult.ok) return { ok: false, reason: fromResult.reason }

  // 3. Normalizar destinatario
  let toAddr: string
  try {
    toAddr = toTwilioWhatsAppAddress(to)
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Teléfono del destinatario inválido",
    }
  }

  // 4. Crear cliente con API Key
  const clientResult = await createTwilioClient()
  if (!clientResult.ok) return { ok: false, reason: clientResult.reason }

  // 5. Enviar
  try {
    const sent = await clientResult.client.messages.create({
      from: fromResult.value,
      to: toAddr,
      body: message,
    })

    return { ok: true, sid: sent.sid, to: toAddr, from: fromResult.value }
  } catch (e) {
    return { ok: false, reason: serializeTwilioSendError(e) }
  }
}

// ─── Serialización de errores ──────────────────────────────────────────────────

export function serializeTwilioSendError(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    const parts: string[] = []
    if (typeof o.message === "string" && o.message) parts.push(o.message)
    if (o.code !== undefined) parts.push(`code=${String(o.code)}`)
    if (typeof o.moreInfo === "string" && o.moreInfo) parts.push(`info=${o.moreInfo}`)
    if (typeof o.status === "number") parts.push(`http=${String(o.status)}`)
    if (parts.length) return parts.join(" | ")
  }
  if (err instanceof Error) return err.message
  return String(err)
}
