"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"

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
    pago: "",
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

  if (!data?.prestamo) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  const p = data.prestamo
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
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/prestamos">← Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            Préstamo de {cliente ? `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim() : `#${id}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cédula: {cliente?.cedula ?? "—"} · Empresa: {cliente?.empresas?.nombre ?? "—"} · Representante:{" "}
            {cliente?.representantes
              ? `${cliente.representantes.nombre ?? ""} ${cliente.representantes.apellido ?? ""}`.trim()
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Capital inicial / acumulado:</span>{" "}
              {formatRD(p.monto as string)}
            </p>
            <p>
              <span className="text-muted-foreground">Capital pendiente:</span>{" "}
              {formatRD(p.capital_pendiente as string)}
            </p>
            <p>
              <span className="text-muted-foreground">Tasa % (por período):</span> {String(p.tasa_interes)}%
            </p>
            <p>
              <span className="text-muted-foreground">Cuotas:</span> {String(p.plazo)} (
              {String(p.tipo_plazo)})
            </p>
            <p>
              <span className="text-muted-foreground">Inicio:</span> {String(p.fecha_inicio)}
            </p>
            <p>
              <span className="text-muted-foreground">Vencimiento final:</span>{" "}
              {String(p.fecha_vencimiento)}
            </p>
            <p>
              <span className="text-muted-foreground">Próximo vencimiento:</span>{" "}
              {String(p.fecha_proximo_vencimiento)}
            </p>
            <p>
              <span className="text-muted-foreground">Estado:</span> {String(p.estado)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reganche (mismo préstamo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Monto a agregar al capital pendiente</Label>
              <Input value={regancheForm.monto} onChange={(e) => setRegancheForm({ ...regancheForm, monto: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={regancheForm.notas} onChange={(e) => setRegancheForm({ ...regancheForm, notas: e.target.value })} />
            </div>
            <Button onClick={reganche}>Aplicar reganche</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo abono</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2">
            <Label>Fecha</Label>
              <CalendarDatePicker
                value={abonoForm.fechaAbono}
                onChange={(value) => setAbonoForm({ ...abonoForm, fechaAbono: value })}
                className="w-full"
              />
          </div>
          <div className="space-y-2">
            <Label>Pago recibido</Label>
            <Input
              value={abonoForm.pago}
              onChange={(e) => setAbonoForm({ ...abonoForm, pago: e.target.value })}
              placeholder="Ej. 1500 (interés + capital)"
            />
          </div>
          <div className="space-y-2">
            <Label>Capital a debitar (manual)</Label>
            <Input
              value={abonoForm.montoCapitalDebitado}
              onChange={(e) =>
                setAbonoForm({ ...abonoForm, montoCapitalDebitado: e.target.value })
              }
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Intereses atrasados pendientes</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => aplicarIntereses()}
            disabled={applyingIntereses}
          >
            {applyingIntereses ? "Aplicando..." : "Aplicar todos al capital"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Interés generado</TableHead>
                <TableHead>Pagado a interés</TableHead>
                <TableHead>Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.intereses_atrasados ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>Sin registros</TableCell>
                </TableRow>
              ) : (
                data.intereses_atrasados.map((i) => (
                  <TableRow key={String(i.id)}>
                    <TableCell>{String(i.fecha_periodo ?? i.fecha_generado)}</TableCell>
                    <TableCell>{formatRD((i.interes_generado as string) ?? (i.monto as string))}</TableCell>
                    <TableCell>{formatRD((i.interes_pagado as string) ?? "0")}</TableCell>
                    <TableCell>{formatRD((i.interes_pendiente as string) ?? (i.monto as string))}</TableCell>
                    <TableCell>{String(i.estado ?? (i.aplicado ? "CAPITALIZADO" : "PENDIENTE"))}</TableCell>
                    <TableCell className="text-right">
                      {String(i.estado ?? "") === "PENDIENTE" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => aplicarIntereses([Number(i.id)])}
                          >
                            Capitalizar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => marcarInteresPagado(Number(i.id))}
                          >
                            Marcar pagado
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => anularInteres(Number(i.id))}
                          >
                            Anular
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de reganches</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto agregado</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.reganches ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>Sin reganches</TableCell>
                </TableRow>
              ) : (
                data.reganches.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell>{String(r.created_at).slice(0, 10)}</TableCell>
                    <TableCell>{formatRD(r.monto_agregado as string)}</TableCell>
                    <TableCell>{(r.notas as string) ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abonos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Interés cobrado</TableHead>
                <TableHead>Capital debitado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Saldo capital</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.abonos ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Sin abonos</TableCell>
                </TableRow>
              ) : (
                data.abonos.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell>{String(a.fecha_abono)}</TableCell>
                    <TableCell>{formatRD(a.interes_cobrado as string)}</TableCell>
                    <TableCell>{formatRD(a.monto_capital_debitado as string)}</TableCell>
                    <TableCell>{formatRD(a.total_pagado as string)}</TableCell>
                    <TableCell>{formatRD(a.saldo_capital_restante as string)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
