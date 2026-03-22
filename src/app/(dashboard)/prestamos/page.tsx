"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { addDays } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { cn } from "@/lib/utils"

type PrestamoList = {
  id: number
  monto: string | number
  capital_pendiente: string | number
  tasa_interes: string | number
  fecha_proximo_vencimiento: string
  estado: string
  clientes: { nombre: string; apellido: string; cedula: string } | null
  /** Interés del período sobre capital pendiente (próxima cuota). */
  interes_proximo: string
  /** Capital sugerido: pendiente ÷ cuotas restantes (plazo − abonos). */
  capital_debitar_proximo: string
  /** interes_proximo + capital_debitar_proximo */
  total_proximo_pago: string
}

function rowTone(p: PrestamoList): "red" | "yellow" | "green" {
  if (p.estado === "MORA") return "red"
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const v = new Date(`${p.fecha_proximo_vencimiento}T12:00:00`)
  if (v < hoy) return "yellow"
  const en7 = addDays(hoy, 7)
  if (v <= en7) return "yellow"
  return "green"
}

export default function PrestamosPage() {
  const [rows, setRows] = useState<PrestamoList[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [clientes, setClientes] = useState<{ id: number; nombre: string; apellido: string }[]>([])
  const [form, setForm] = useState({
    clienteId: "",
    monto: "",
    tasaInteres: "",
    plazo: "12",
    tipoPlazo: "MENSUAL",
    fechaInicio: new Date().toISOString().slice(0, 10),
    notas: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchApi<{ data: PrestamoList[] }>("/api/prestamos")
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
    } else {
      setRows(res.data.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/clientes?pageSize=500")
      .then((r) => r.json())
      .then((j) => setClientes(j.data ?? []))
  }, [])

  const crear = async () => {
    const res = await fetchApi("/api/prestamos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: Number(form.clienteId),
        monto: form.monto,
        tasaInteres: form.tasaInteres,
        plazo: Number(form.plazo),
        tipoPlazo: form.tipoPlazo,
        fechaInicio: form.fechaInicio,
        notas: form.notas || null,
      }),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    toast.success("Préstamo creado")
    setOpen(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Préstamos</h1>
          <p className="text-sm text-muted-foreground">
            Rojo: mora · Amarillo: vence en 7 días · Verde: al día.{" "}
            <span className="block sm:inline">
              “Capital a debitar” y “Próximo pago” son estimados según cuotas restantes (plazo − abonos).
            </span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() =>
                setForm({
                  clienteId: "",
                  monto: "",
                  tasaInteres: "",
                  plazo: "12",
                  tipoPlazo: "MENSUAL",
                  fechaInicio: new Date().toISOString().slice(0, 10),
                  notas: "",
                })
              }
            >
              <Plus className="mr-2 size-4" />
              Nuevo préstamo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo préstamo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.clienteId} onValueChange={(v) => setForm({ ...form, clienteId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre} {c.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto (capital inicial)</Label>
                <Input
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label>Tasa % por período</Label>
                <Input
                  value={form.tasaInteres}
                  onChange={(e) => setForm({ ...form, tasaInteres: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Cuotas</Label>
                  <Input
                    value={form.plazo}
                    onChange={(e) => setForm({ ...form, plazo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Periodicidad</Label>
                  <Select
                    value={form.tipoPlazo}
                    onValueChange={(v) => setForm({ ...form, tipoPlazo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIARIO">Diario</SelectItem>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                      <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                      <SelectItem value="MENSUAL">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={crear}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Monto original</TableHead>
              <TableHead>Interés pendiente</TableHead>
              <TableHead className="min-w-[9rem]">Capital a debitar</TableHead>
              <TableHead>Tasa %</TableHead>
              <TableHead>Próximo venc.</TableHead>
              <TableHead>Próximo pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>Sin préstamos</TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const tone = rowTone(p)
                const saldado = p.estado === "SALDADO"
                return (
                  <TableRow
                    key={p.id}
                    className={cn(
                      tone === "red" && "bg-red-500/10",
                      tone === "yellow" && "bg-amber-500/10",
                      tone === "green" && "bg-emerald-500/5",
                    )}
                  >
                    <TableCell className="font-medium">
                      {p.clientes ? `${p.clientes.nombre} ${p.clientes.apellido}` : "—"}
                    </TableCell>
                    <TableCell>{formatRD(p.monto)}</TableCell>
                    <TableCell>{saldado ? "—" : formatRD(p.interes_proximo)}</TableCell>
                    <TableCell>{saldado ? "—" : formatRD(p.capital_debitar_proximo)}</TableCell>
                    <TableCell>{p.tasa_interes}%</TableCell>
                    <TableCell>{p.fecha_proximo_vencimiento}</TableCell>
                    <TableCell className="font-medium">
                      {saldado ? "—" : formatRD(p.total_proximo_pago)}
                    </TableCell>
                    <TableCell>{p.estado}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/prestamos/${p.id}`}>Detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
