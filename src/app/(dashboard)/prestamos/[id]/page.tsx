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
    montoCapitalDebitado: "0",
    observaciones: "",
  })
  const [regancheForm, setRegancheForm] = useState({ monto: "", notas: "" })

  const load = useCallback(async () => {
    const r = await fetch(`/api/prestamos/${id}`)
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    setData(j)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const registrarAbono = async () => {
    const r = await fetch(`/api/prestamos/${id}/abonos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(abonoForm),
    })
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    toast.success("Abono registrado")
    load()
  }

  const reganche = async () => {
    const r = await fetch(`/api/prestamos/${id}/reganche`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montoAgregado: regancheForm.monto, notas: regancheForm.notas || null }),
    })
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    toast.success("Reganche aplicado al mismo préstamo")
    setRegancheForm({ monto: "", notas: "" })
    load()
  }

  const aplicarIntereses = async () => {
    const r = await fetch(`/api/prestamos/${id}/aplicar-interes-atrasado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    toast.success("Intereses aplicados al capital")
    load()
  }

  if (!data?.prestamo) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  const p = data.prestamo

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/prestamos">← Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold">Préstamo #{id}</h1>
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
            <Input
              type="date"
              value={abonoForm.fechaAbono}
              onChange={(e) => setAbonoForm({ ...abonoForm, fechaAbono: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Capital a descontar (0 = solo interés)</Label>
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
          <Button onClick={registrarAbono}>Registrar abono</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Intereses atrasados pendientes</CardTitle>
          <Button variant="secondary" size="sm" onClick={aplicarIntereses}>
            Aplicar todos al capital
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha ref.</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Aplicado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.intereses_atrasados ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>Sin registros</TableCell>
                </TableRow>
              ) : (
                data.intereses_atrasados.map((i) => (
                  <TableRow key={String(i.id)}>
                    <TableCell>{String(i.fecha_generado)}</TableCell>
                    <TableCell>{formatRD(i.monto as string)}</TableCell>
                    <TableCell>{i.aplicado ? "Sí" : "No"}</TableCell>
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
