"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker"
import { GestionCobranzaPanel } from "@/components/gestion-cobranza-panel"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatMontoAbonoOGuion, getInteresRecibidoFromAbono } from "@/lib/abonos-display"
import { formatRD } from "@/lib/format-currency"
import { interesPeriodo } from "@/lib/finance"
import { cn } from "@/lib/utils"

function estBadgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  const u = estado.toUpperCase()
  if (u === "MORA") return "destructive"
  if (u === "SALDADO") return "secondary"
  return "default"
}

function estadoInteresBadge(estado: string) {
  const u = estado.toUpperCase()
  if (u === "PENDIENTE") return { label: "Pendiente", variant: "outline" as const }
  if (u === "PAGADO") return { label: "Pagado", variant: "secondary" as const }
  if (u === "CAPITALIZADO") return { label: "Capitalizado", variant: "default" as const }
  if (u === "ANULADO") return { label: "Anulado", variant: "secondary" as const }
  return { label: estado, variant: "outline" as const }
}

function origenCapitalBadge(origen: string | null | undefined) {
  if (!origen) return null
  const u = String(origen).toUpperCase()
  if (u === "AUTO") return <Badge variant="default">AUTO</Badge>
  if (u === "MANUAL") return <Badge variant="secondary">MANUAL</Badge>
  return <Badge variant="outline">{origen}</Badge>
}

function regancheTipoBadge(notas: string | null | undefined) {
  const n = String(notas ?? "")
  if (n.startsWith("AUTO:")) return <Badge variant="default">AUTO</Badge>
  if (n.startsWith("MANUAL:")) return <Badge variant="secondary">MANUAL</Badge>
  return <Badge variant="outline">Reganche</Badge>
}

export default function PrestamoDetallePage() {
  const params = useParams()
  const id = Number(params.id)
  const [data, setData] = useState<{
    prestamo: Record<string, unknown>
    abonos: Record<string, unknown>[]
    intereses_atrasados: Record<string, unknown>[]
    reganches: Record<string, unknown>[]
  } | null>(null)

  const [abonoForm, setAbonoForm] = useState({
    fechaAbono: new Date().toISOString().slice(0, 10),
    interesRecibido: "",
    montoCapitalDebitado: "0",
    observaciones: "",
  })
  const [regancheForm, setRegancheForm] = useState({ monto: "", notas: "" })
  const [savingAbono, setSavingAbono] = useState(false)
  const [savingReganche, setSavingReganche] = useState(false)
  const [applyingIntereses, setApplyingIntereses] = useState(false)

  const load = useCallback(async () => {
    const res = await fetchApi<{
      prestamo: Record<string, unknown>
      abonos: Record<string, unknown>[]
      intereses_atrasados: Record<string, unknown>[]
      reganches: Record<string, unknown>[]
    }>(`/api/prestamos/${id}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    setData(res.data)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const registrarAbono = async () => {
    if (savingAbono) return
    setSavingAbono(true)
    const res = await fetchApi(`/api/prestamos/${id}/abonos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(abonoForm),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setSavingAbono(false)
      return
    }
    toast.success("Abono registrado")
    await load()
    setSavingAbono(false)
  }

  const reganche = async () => {
    if (savingReganche) return
    setSavingReganche(true)
    const r = await fetch(`/api/prestamos/${id}/reganche`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montoAgregado: regancheForm.monto, notas: regancheForm.notas || null }),
    })
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      setSavingReganche(false)
      return
    }
    toast.success("Reganche aplicado al mismo préstamo")
    setRegancheForm({ monto: "", notas: "" })
    await load()
    setSavingReganche(false)
  }

  const aplicarIntereses = async (ids?: number[]) => {
    const ok = window.confirm(
      ids?.length
        ? "¿Aplicar este interés pendiente al capital del préstamo?"
        : "¿Aplicar TODOS los intereses pendientes al capital del préstamo?",
    )
    if (!ok) return
    if (applyingIntereses) return
    setApplyingIntereses(true)
    const res = await fetchApi(`/api/prestamos/${id}/aplicar-interes-atrasado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids?.length ? { ids } : {}),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setApplyingIntereses(false)
      return
    }
    toast.success("Intereses aplicados al capital")
    await load()
    setApplyingIntereses(false)
  }

  const marcarInteresPagado = async (interesId: number) => {
    const ok = window.confirm("¿Marcar este interés pendiente como pagado (sin capitalizar)?")
    if (!ok) return
    const res = await fetchApi(`/api/prestamos/${id}/intereses-atrasados/${interesId}/marcar-pagado`, {
      method: "POST",
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    toast.success("Interés marcado como pagado")
    await load()
  }

  const anularInteres = async (interesId: number) => {
    const ok = window.confirm("¿Seguro que deseas anular este interés pendiente?")
    if (!ok) return
    const res = await fetchApi(`/api/prestamos/${id}/intereses-atrasados/${interesId}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    toast.success("Interés pendiente anulado")
    await load()
  }

  const prestamoResumen = data?.prestamo
  const interesCalculadoPeriodo = useMemo(() => {
    if (!prestamoResumen) return "0.00"
    try {
      return interesPeriodo(
        String(prestamoResumen.capital_pendiente ?? "0"),
        String(prestamoResumen.tasa_interes ?? "0"),
      )
    } catch {
      return "0.00"
    }
  }, [prestamoResumen?.capital_pendiente, prestamoResumen?.tasa_interes])

  const agregados = useMemo(() => {
    if (!data) return null
    const abonos = data.abonos ?? []
    const intereses = data.intereses_atrasados ?? []
    const reganches = data.reganches ?? []
    const totalAbonado = abonos.reduce((s, a) => s + Number(a.total_pagado ?? 0), 0)
    const interesPendienteAcumulado = intereses
      .filter((i) => String(i.estado ?? "").toUpperCase() === "PENDIENTE")
      .reduce((s, i) => s + Number(i.interes_pendiente ?? i.monto ?? 0), 0)
    let capAuto = 0
    let capManual = 0
    let otrosReg = 0
    for (const r of reganches) {
      const n = String(r.notas ?? "")
      const m = Number(r.monto_agregado ?? 0)
      if (n.startsWith("AUTO:")) capAuto += m
      else if (n.startsWith("MANUAL:")) capManual += m
      else otrosReg += m
    }
    return { totalAbonado, interesPendienteAcumulado, capAuto, capManual, otrosReg }
  }, [data])

  if (!data?.prestamo) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  const p = data.prestamo
  const estadoStr = String(p.estado ?? "")
  const cliente = p.clientes as
    | {
        nombre?: string
        apellido?: string
        cedula?: string
        empresas?: { nombre?: string }
        representantes?: { nombre?: string; apellido?: string }
      }
    | undefined

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/prestamos">← Volver</Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Préstamo de {cliente ? `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim() : `#${id}`}
              </h1>
              <Badge variant={estBadgeVariant(estadoStr)} className="text-sm">
                {estadoStr}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cédula: {cliente?.cedula ?? "—"} · Empresa: {cliente?.empresas?.nombre ?? "—"} · Representante:{" "}
              {cliente?.representantes
                ? `${cliente.representantes.nombre ?? ""} ${cliente.representantes.apellido ?? ""}`.trim()
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {agregados && (
        <section aria-label="Resumen financiero">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumen financiero
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Capital pendiente
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {formatRD(p.capital_pendiente as string)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Saldo actual del principal por liquidar</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Interés del período
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatRD(interesCalculadoPeriodo)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sobre capital pendiente ({String(p.tasa_interes)}% por período)
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Interés pendiente acumulado
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums",
                  agregados.interesPendienteAcumulado > 0 && "text-amber-700 dark:text-amber-400",
                )}
              >
                {formatRD(agregados.interesPendienteAcumulado)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Suma de períodos en estado Pendiente</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total abonado
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatRD(agregados.totalAbonado)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Suma de «Total» en movimientos de abono</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Interés capitalizado al principal
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2">
                  <Badge variant="default">AUTO</Badge>
                  <span className="text-lg font-semibold tabular-nums">{formatRD(agregados.capAuto)}</span>
                </span>
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <span className="inline-flex items-center gap-2">
                  <Badge variant="secondary">MANUAL</Badge>
                  <span className="text-lg font-semibold tabular-nums">{formatRD(agregados.capManual)}</span>
                </span>
                {agregados.otrosReg > 0 && (
                  <>
                    <Separator orientation="vertical" className="hidden h-6 md:block" />
                    <span className="text-sm text-muted-foreground">
                      Otros reganches:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatRD(agregados.otrosReg)}
                      </span>
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Desglose según movimientos en historial (notas AUTO / MANUAL)
              </p>
            </div>
          </div>
        </section>
      )}

      {p.cliente_id != null ? (
        <GestionCobranzaPanel clienteId={Number(p.cliente_id)} prestamoId={id} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condiciones del préstamo</CardTitle>
            <CardDescription>Datos del contrato y calendario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Capital inicial / acumulado</span>
              <span className="font-medium tabular-nums">{formatRD(p.monto as string)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Tasa (por período)</span>
              <span className="font-medium">{String(p.tasa_interes)}%</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Plazo</span>
              <span className="font-medium">
                {String(p.plazo)} × {String(p.tipo_plazo)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Inicio</span>
              <span>{String(p.fecha_inicio)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Vencimiento final</span>
              <span>{String(p.fecha_vencimiento)}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <span className="text-muted-foreground">Próximo vencimiento</span>
              <span className="font-medium">{String(p.fecha_proximo_vencimiento)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reganche (mismo préstamo)</CardTitle>
            <CardDescription>Carga adicional al capital pendiente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Monto a agregar al capital pendiente</Label>
              <Input
                value={regancheForm.monto}
                onChange={(e) => setRegancheForm({ ...regancheForm, monto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={regancheForm.notas}
                onChange={(e) => setRegancheForm({ ...regancheForm, notas: e.target.value })}
              />
            </div>
            <Button onClick={reganche}>Aplicar reganche</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar abono</CardTitle>
          <CardDescription>
            Referencia de interés del período:{" "}
            <span className="font-medium text-foreground">{formatRD(interesCalculadoPeriodo)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <CalendarDatePicker
                value={abonoForm.fechaAbono}
                onChange={(value) => setAbonoForm({ ...abonoForm, fechaAbono: value })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Interés recibido</Label>
              <Input
                value={abonoForm.interesRecibido}
                onChange={(e) => setAbonoForm({ ...abonoForm, interesRecibido: e.target.value })}
                placeholder="Monto de interés que pagó el cliente"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                Si es menor que el interés calculado, la diferencia queda en intereses pendientes.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Capital a debitar (manual)</Label>
              <Input
                value={abonoForm.montoCapitalDebitado}
                onChange={(e) => setAbonoForm({ ...abonoForm, montoCapitalDebitado: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                value={abonoForm.observaciones}
                onChange={(e) => setAbonoForm({ ...abonoForm, observaciones: e.target.value })}
              />
            </div>
            <Button onClick={registrarAbono} disabled={savingAbono}>
              {savingAbono ? "Registrando..." : "Registrar abono"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Intereses por período</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Generadas por cada fecha de pago. Si pasan más de 3 días desde el período sin cubrir el interés, al
              abrir este detalle puede capitalizarse automáticamente al capital (origen AUTO). Puedes capitalizar
              manualmente, marcar como pagado o anular.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => aplicarIntereses()}
            disabled={applyingIntereses}
          >
            {applyingIntereses ? "Aplicando..." : "Aplicar todos al capital"}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Generado</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.intereses_atrasados ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Sin registros
                  </TableCell>
                </TableRow>
              ) : (
                data.intereses_atrasados.map((i) => {
                  const est = String(i.estado ?? (i.aplicado ? "CAPITALIZADO" : "PENDIENTE"))
                  const eb = estadoInteresBadge(est)
                  return (
                    <TableRow key={String(i.id)}>
                      <TableCell className="text-sm font-medium">{String(i.fecha_periodo ?? i.fecha_generado)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRD((i.interes_generado as string) ?? (i.monto as string))}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRD((i.interes_pagado as string) ?? "0")}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRD((i.interes_pendiente as string) ?? (i.monto as string))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eb.variant}>{eb.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {est.toUpperCase() === "CAPITALIZADO"
                          ? origenCapitalBadge((i as { origen_capitalizacion?: string | null }).origen_capitalizacion) ?? (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                      </TableCell>
                      <TableCell className="text-right">
                        {String(i.estado ?? "") === "PENDIENTE" && (
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => aplicarIntereses([Number(i.id)])}>
                              Capitalizar
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => marcarInteresPagado(Number(i.id))}>
                              Marcar pagado
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => anularInteres(Number(i.id))}>
                              Anular
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de reganches</CardTitle>
          <CardDescription>
            Aumentos al capital: reganche manual (formulario) o capitalización de interés (AUTO / MANUAL).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.reganches ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Sin movimientos
                  </TableCell>
                </TableRow>
              ) : (
                data.reganches.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm whitespace-nowrap">{String(r.created_at).slice(0, 10)}</TableCell>
                    <TableCell>{regancheTipoBadge(r.notas as string | undefined)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {formatRD(r.monto_agregado as string)}
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{(r.notas as string) ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de abonos</CardTitle>
          <CardDescription>
            El capital pendiente solo baja por «Capital debitado». La columna «Dif. a pendiente» refleja el interés
            no cubierto en ese movimiento; filas antiguas pueden mostrar «—» si no existían esas columnas.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Int. calculado</TableHead>
                <TableHead className="text-right">Int. recibido</TableHead>
                <TableHead className="text-right">Int. aplicado</TableHead>
                <TableHead className="text-right">Dif. a pend. interés</TableHead>
                <TableHead className="text-right">Capital debitado</TableHead>
                <TableHead className="text-right">Total mov.</TableHead>
                <TableHead className="text-right">Saldo capital</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.abonos ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Sin abonos
                  </TableCell>
                </TableRow>
              ) : (
                data.abonos.map((a) => {
                  const row = a as Record<string, unknown>
                  const recibido = getInteresRecibidoFromAbono(row)
                  return (
                    <TableRow key={String(a.id)}>
                      <TableCell className="text-sm whitespace-nowrap">{String(a.fecha_abono)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatMontoAbonoOGuion(row.interes_calculado)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {recibido != null ? formatRD(recibido) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatRD(a.interes_cobrado as string)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatMontoAbonoOGuion(row.diferencia_interes_pendiente)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRD(a.monto_capital_debitado as string)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatRD(a.total_pagado as string)}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatRD(a.saldo_capital_restante as string)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
