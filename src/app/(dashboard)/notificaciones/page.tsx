"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { useDebouncedValue } from "@/lib/use-debounced-value"

type NotifRow = {
  id: number
  canal: string
  estado: string
  fecha_envio: string
  mensaje: string
  error_detalle: string | null
  twilio_from?: string | null
  twilio_to?: string | null
  twilio_message_sid?: string | null
  email_to?: string | null
  representantes: { nombre: string; apellido: string } | null
}

export default function NotificacionesPage() {
  const [rows, setRows] = useState<NotifRow[]>([])
  const [reps, setReps] = useState<{ id: number; nombre: string; apellido: string }[]>([])
  const [filtroRep, setFiltroRep] = useState("")
  const [filtroCedula, setFiltroCedula] = useState("")
  const filtroCedulaDebounced = useDebouncedValue(filtroCedula, 350)
  const [canal, setCanal] = useState("")
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [sendingPreview, setSendingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState("")
  const [form, setForm] = useState({
    enviarATodos: false,
    representanteId: "",
    canal: "AMBOS" as "WHATSAPP" | "EMAIL" | "AMBOS",
  })

  const load = useCallback(async () => {
    setLoadingHistorial(true)
    const q = new URLSearchParams()
    if (filtroRep) q.set("representanteId", filtroRep)
    if (filtroCedulaDebounced) q.set("cedula", filtroCedulaDebounced)
    if (canal) q.set("canal", canal)
    const res = await fetchApi<{ data: NotifRow[] }>(`/api/notificaciones?${q}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
    } else {
      setRows(res.data.data ?? [])
    }
    setLoadingHistorial(false)
  }, [filtroRep, filtroCedulaDebounced, canal])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/representantes?pageSize=200")
      .then((r) => r.json())
      .then((j) => setReps(j.data ?? []))
  }, [])

  const vistaPrevia = async () => {
    if (sendingPreview) return
    setSendingPreview(true)
    const body: Record<string, unknown> = {
      canal: form.canal,
      vistaPrevia: true,
      enviarATodos: form.enviarATodos,
    }
    if (!form.enviarATodos && form.representanteId) {
      body.representanteIds = [Number(form.representanteId)]
    }
    const res = await fetchApi<{ data: { mensaje?: string }[] }>("/api/notificaciones/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setSendingPreview(false)
      return
    }
    const first = res.data.data?.[0]
    setPreview(first?.mensaje ?? JSON.stringify(res.data, null, 2))
    toast.message("Vista previa generada")
    setSendingPreview(false)
  }

  const enviar = async () => {
    if (sending) return
    setSending(true)
    const body: Record<string, unknown> = {
      canal: form.canal,
      vistaPrevia: false,
      enviarATodos: form.enviarATodos,
    }
    if (!form.enviarATodos && form.representanteId) {
      body.representanteIds = [Number(form.representanteId)]
    }
    const res = await fetchApi("/api/notificaciones/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setSending(false)
      return
    }
    toast.success("Proceso de envío terminado")
    await load()
    setSending(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <p className="text-sm text-muted-foreground">
          Reporte de mora por WhatsApp (Twilio) y correo (Resend). Configura variables de entorno.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all"
              checked={form.enviarATodos}
              onChange={(e) => setForm({ ...form, enviarATodos: e.target.checked })}
            />
            <Label htmlFor="all">Enviar a todos los representantes</Label>
          </div>
          {!form.enviarATodos && (
            <div className="space-y-2">
              <Label>Representante</Label>
              <Select
                value={form.representanteId}
                onValueChange={(v) => setForm({ ...form, representanteId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.nombre} {r.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select
              value={form.canal}
              onValueChange={(v) => setForm({ ...form, canal: v as typeof form.canal })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="AMBOS">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={vistaPrevia} disabled={sendingPreview} className="w-full sm:w-auto">
              {sendingPreview ? "Generando..." : "Vista previa"}
            </Button>
            <Button onClick={enviar} disabled={sending} className="w-full sm:w-auto">
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Vista previa del mensaje</Label>
          <Textarea value={preview} readOnly className="min-h-[200px] font-mono text-xs" placeholder="Pulsa “Vista previa”" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={filtroRep || "all"} onValueChange={(v) => setFiltroRep(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Representante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los representantes</SelectItem>
            {reps.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.nombre} {r.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filtrar por cédula"
          value={filtroCedula}
          onChange={(e) => setFiltroCedula(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select value={canal || "all"} onValueChange={(v) => setCanal(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="AMBOS">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} className="w-full sm:w-auto">
          Aplicar filtros
        </Button>
      </div>

      <div className="hidden md:block rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Envío</TableHead>
              <TableHead>Mensaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingHistorial ? (
              <TableRow>
                <TableCell colSpan={6}>Cargando...</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Sin historial</TableCell>
              </TableRow>
            ) : (
              rows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(n.fecha_envio).toLocaleString("es-DO")}
                  </TableCell>
                  <TableCell>
                    {n.representantes
                      ? `${n.representantes.nombre} ${n.representantes.apellido}`
                      : "—"}
                  </TableCell>
                  <TableCell>{n.canal}</TableCell>
                  <TableCell>
                    {n.estado}
                    {n.error_detalle ? (
                      <span className="block text-xs text-destructive">{n.error_detalle}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[220px] align-top text-[10px] leading-snug text-muted-foreground">
                    {n.twilio_from || n.twilio_to ? (
                      <span className="block font-mono break-all">
                        {n.twilio_from ?? "—"} → {n.twilio_to ?? "—"}
                      </span>
                    ) : null}
                    {n.twilio_message_sid ? (
                      <span className="mt-0.5 block font-mono text-[10px]">SID {n.twilio_message_sid}</span>
                    ) : null}
                    {n.email_to ? <span className="mt-0.5 block break-all">Email {n.email_to}</span> : null}
                    {!n.twilio_from && !n.twilio_to && !n.email_to ? "—" : null}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs">{n.mensaje}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden block space-y-3">
        {loadingHistorial ? (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
            Sin historial
          </div>
        ) : (
          rows.map((n) => {
            const isError = String(n.estado ?? "").toUpperCase() === "ERROR"
            return (
              <div key={n.id} className="rounded-xl border border-border/60 bg-card/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(n.fecha_envio).toLocaleString("es-DO")}
                      </span>
                      <Badge
                        variant={isError ? "destructive" : "secondary"}
                        className="uppercase tracking-wide"
                      >
                        {n.estado}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold">
                      {n.representantes ? `${n.representantes.nombre} ${n.representantes.apellido}` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Canal: {n.canal}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {n.twilio_from || n.twilio_to ? (
                    <p className="font-mono text-[10px] text-muted-foreground break-all">
                      WA {n.twilio_from ?? "—"} → {n.twilio_to ?? "—"}
                    </p>
                  ) : null}
                  {n.twilio_message_sid ? (
                    <p className="font-mono text-[10px] text-muted-foreground">SID {n.twilio_message_sid}</p>
                  ) : null}
                  {n.email_to ? (
                    <p className="text-[10px] text-muted-foreground break-all">Email {n.email_to}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Mensaje</p>
                  <p className="text-sm leading-snug line-clamp-4">{n.mensaje}</p>
                  {n.error_detalle ? <p className="text-xs text-destructive">{n.error_detalle}</p> : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
