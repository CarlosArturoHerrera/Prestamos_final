"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import {
  RESULTADO_GESTION_LABELS,
  RESULTADOS_GESTION_COBRANZA,
  labelResultadoGestion,
  type ResultadoGestionCobranza,
} from "@/lib/gestion-cobranza"
import { cn } from "@/lib/utils"

type GestionRow = {
  id: number
  cliente_id: number
  prestamo_id: number | null
  notas: string | null
  promesa_monto: string | number | null
  promesa_fecha: string | null
  proxima_fecha_contacto: string | null
  resultado: string
  created_at: string
  prestamos?: { id: number; estado?: string; capital_pendiente?: string } | null
}

function badgeVariantResultado(codigo: string): "default" | "secondary" | "destructive" | "outline" {
  const u = codigo.toUpperCase()
  if (u === "NO_RESPONDE" || u === "PROMESA_INCUMPLIDA") return "destructive"
  if (u === "PROMESA_CUMPLIDA" || u === "CONTACTADO") return "secondary"
  if (u === "PAGARA_HOY") return "default"
  return "outline"
}

export type PrestamoOpcionGestion = { id: number; label: string }

type Props = {
  clienteId: number
  /** Si se define, el historial y los altas son solo de este préstamo. */
  prestamoId?: number
  /** Solo en vista cliente: elegir préstamo opcional al registrar. */
  prestamosOpciones?: PrestamoOpcionGestion[]
  className?: string
}

export function GestionCobranzaPanel({ clienteId, prestamoId, prestamosOpciones, className }: Props) {
  const [items, setItems] = useState<GestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [notas, setNotas] = useState("")
  const [promesaMonto, setPromesaMonto] = useState("")
  const [promesaFecha, setPromesaFecha] = useState("")
  const [proximaFechaContacto, setProximaFechaContacto] = useState("")
  const [resultado, setResultado] = useState<ResultadoGestionCobranza>("CONTACTADO")
  const [prestamoIdForm, setPrestamoIdForm] = useState<string>("")

  const basePath = prestamoId != null ? `/api/prestamos/${prestamoId}/gestion-cobranza` : `/api/clientes/${clienteId}/gestion-cobranza`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchApi<{ items: GestionRow[] }>(basePath)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setItems([])
    } else {
      setItems(res.data.items ?? [])
    }
    setLoading(false)
  }, [basePath])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setNotas("")
    setPromesaMonto("")
    setPromesaFecha("")
    setProximaFechaContacto("")
    setResultado("CONTACTADO")
    setPrestamoIdForm("")
  }

  const enviar = async () => {
    if (saving) return
    setSaving(true)
    const body: Record<string, unknown> = {
      notas: notas.trim() || null,
      promesaMonto: promesaMonto.trim() || undefined,
      promesaFecha: promesaFecha || undefined,
      proximaFechaContacto: proximaFechaContacto || undefined,
      resultado,
    }
    if (prestamoId == null && prestamoIdForm) {
      body.prestamoId = Number(prestamoIdForm)
    }
    const res = await fetchApi(basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setSaving(false)
      return
    }
    toast.success("Seguimiento registrado")
    resetForm()
    await load()
    setSaving(false)
  }

  const showPrestamoPicker = prestamoId == null && (prestamosOpciones?.length ?? 0) > 0

  const titulo = useMemo(
    () => (prestamoId != null ? "Seguimiento de cobranza (este préstamo)" : "Seguimiento de cobranza (cliente)"),
    [prestamoId],
  )

  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-primary" />
          {titulo}
        </CardTitle>
        <CardDescription>
          Notas operativas, promesas de pago y próximo contacto. No modifica montos ni abonos del préstamo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Registrar gestión</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Resultado de la gestión</Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoGestionCobranza)}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTADOS_GESTION_COBRANZA.map((k) => (
                    <SelectItem key={k} value={k}>
                      {RESULTADO_GESTION_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showPrestamoPicker ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Préstamo (opcional)</Label>
                <Select value={prestamoIdForm || "__none__"} onValueChange={(v) => setPrestamoIdForm(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Solo cliente / general" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Solo cliente (sin préstamo)</SelectItem>
                    {(prestamosOpciones ?? []).map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas de gestión</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Conversación, acuerdos, observaciones…"
                rows={3}
                className="min-h-[5rem] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Promesa — monto (RD$)</Label>
              <Input
                value={promesaMonto}
                onChange={(e) => setPromesaMonto(e.target.value)}
                inputMode="decimal"
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Promesa — fecha</Label>
              <CalendarDatePicker
                value={promesaFecha}
                onChange={setPromesaFecha}
                placeholder="Fecha prometida de pago"
                className="w-full"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Próxima fecha de contacto</Label>
              <CalendarDatePicker
                value={proximaFechaContacto}
                onChange={setProximaFechaContacto}
                placeholder="Cuándo volver a llamar o visitar"
                className="w-full max-w-xs"
              />
            </div>
          </div>
          <Button type="button" onClick={() => void enviar()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar seguimiento"}
          </Button>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Historial</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay registros de gestión.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((row) => {
                const pr = row.prestamos
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {String(row.created_at).slice(0, 16).replace("T", " ")}
                        </span>
                        <Badge variant={badgeVariantResultado(row.resultado)} className="text-xs">
                          {labelResultadoGestion(row.resultado)}
                        </Badge>
                      </div>
                      {row.prestamo_id != null ? (
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                          <Link href={`/prestamos/${row.prestamo_id}`}>Préstamo #{row.prestamo_id}</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nivel cliente</span>
                      )}
                    </div>
                    {pr ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Estado préstamo: {String(pr.estado ?? "—")} · Capital pend.{" "}
                        {pr.capital_pendiente != null ? formatRD(pr.capital_pendiente) : "—"}
                      </p>
                    ) : null}
                    {row.notas ? <p className="mt-2 whitespace-pre-wrap text-foreground">{row.notas}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {row.promesa_monto != null && Number(row.promesa_monto) > 0 ? (
                        <span>Promesa: {formatRD(row.promesa_monto)}</span>
                      ) : null}
                      {row.promesa_fecha ? <span>Fecha promesa: {row.promesa_fecha}</span> : null}
                      {row.proxima_fecha_contacto ? (
                        <span className="font-medium text-amber-800 dark:text-amber-300">
                          Próx. contacto: {row.proxima_fecha_contacto}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
