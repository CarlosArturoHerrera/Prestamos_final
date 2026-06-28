/**
 * Currency input utilities for live formatting of money fields.
 * Follows the same pattern as formatters.ts (phone/cedula).
 * Database always stores raw numeric strings; formatting is purely presentational.
 */

/**
 * Strips all non-numeric characters except the decimal point.
 * Keeps only the first decimal point if multiple are present.
 * "1,000,000"    → "1000000"
 * "RD$1,000.50"  → "1000.50"
 * "1.2.3"        → "1.23"
 */
export function unformatCurrency(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

/**
 * Live mask for currency input — adds thousands separators as the user types.
 * Supports optional decimal places.
 *
 * "1000"      → "1,000"
 * "10000"     → "10,000"
 * "100000"    → "100,000"
 * "1000000"   → "1,000,000"
 * "1000.50"   → "1,000.50"
 */
export function maskCurrencyInput(input: string): string {
  const cleaned = unformatCurrency(input);
  const parts = cleaned.split(".");
  const intPart = parts[0];
  const decPart = parts.length > 1 ? parts[1] : undefined;

  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/**
 * Formats a stored or numeric value for display inside a currency input
 * (thousands separators, no currency symbol).
 *
 * "1000000"      → "1,000,000"
 * 1000000        → "1,000,000"
 * "RD$1,000,000" → "1,000,000"
 * null / ""      → ""
 */
export function formatCurrencyInput(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "";
  const raw = typeof value === "number" ? String(value) : value;
  return maskCurrencyInput(unformatCurrency(raw));
}

/**
 * Parses a formatted currency string to a clean numeric string for
 * database storage or API payloads.
 *
 * "1,000,000"    → "1000000"
 * "RD$1,000.50"  → "1000.50"
 * ""             → ""
 */
export function parseCurrency(value: string): string {
  if (!value?.trim()) return "";
  return unformatCurrency(value);
}

/**
 * Validates that a value is a valid positive currency amount.
 * Accepts both formatted ("1,000") and raw ("1000") strings.
 */
export function isValidCurrency(value: string): boolean {
  const raw = unformatCurrency(value);
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
