const fmt = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatRD(value: string | number | null | undefined): string {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return fmt.format(0)
  return fmt.format(n)
}
