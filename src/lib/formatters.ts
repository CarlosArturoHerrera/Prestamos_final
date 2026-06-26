/**
 * Formatting utilities for Dominican phone numbers and cedulas.
 * Database always stores raw digits (no formatting characters).
 */

// ─── Phone ────────────────────────────────────────────────────────────────────

/**
 * Formats a phone number for display.
 * "8094322344"          → "809-432-2344"
 * "+18094322344"        → "+1 809-432-2344"
 * "18094322344"         → "+1 809-432-2344"
 * "whatsapp:+1809..."   → "+1 809-432-2344"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—"
  const cleaned = phone.replace(/^whatsapp:/i, "").trim()
  const digits = cleaned.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return cleaned
}

/** Strips all non-digit characters: "809-432-2344" → "8094322344" */
export function unformatPhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * Live-mask for phone input (10-digit DR numbers).
 * "8094"       → "809-4"
 * "809432"     → "809-432"
 * "8094322344" → "809-432-2344"
 */
export function maskPhone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** Validates a Dominican phone number (10-digit 809/829/849, or 11-digit with leading 1). */
export function isValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "")
  if (d.length === 10) return /^(809|829|849)\d{7}$/.test(d)
  if (d.length === 11) return /^1(809|829|849)\d{7}$/.test(d)
  return false
}

// ─── Cédula ───────────────────────────────────────────────────────────────────

/**
 * Formats a cedula for display.
 * "40230620904" → "402-3062090-4"
 */
export function formatCedula(cedula: string | null | undefined): string {
  if (!cedula) return "—"
  const d = cedula.replace(/\D/g, "")
  if (d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
  }
  return cedula
}

/** Strips all non-digit characters: "402-3062090-4" → "40230620904" */
export function unformatCedula(cedula: string): string {
  return cedula.replace(/\D/g, "")
}

/**
 * Live-mask for cedula input (11-digit Dominican cedulas).
 * "4023"        → "402-3"
 * "40230620904" → "402-3062090-4"
 */
export function maskCedula(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
}

/**
 * Validates a Dominican cedula (11 digits, mod-10 checksum).
 */
export function isValidCedula(cedula: string): boolean {
  const d = cedula.replace(/\D/g, "")
  if (d.length !== 11) return false
  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let p = Number(d[i]) * weights[i]
    if (p > 9) p -= 9
    sum += p
  }
  return (10 - (sum % 10)) % 10 === Number(d[10])
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Strips formatting characters from a search term so "809-432-2344" matches "8094322344"
 * and "402-3062090-4" matches "40230620904" in database queries.
 */
export function normalizeSearchTerm(term: string): string {
  return term.replace(/[-\s+]/g, "")
}
