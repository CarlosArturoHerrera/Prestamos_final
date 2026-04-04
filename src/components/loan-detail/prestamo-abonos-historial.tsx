"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRD } from "@/lib/format-currency"

type Props = {
  abonos: Record<string, unknown>[]
}

function num(v: unknown): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (Number.isNaN(n)) return "—"
  return formatRD(n)
}

export function PrestamoAbonosHistorial({ abonos }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de abonos</CardTitle>
        <CardDescription>
          El capital pendiente solo baja por «Capital debitado». La columna «Dif. a pendiente» refleja el
          interés no cubierto en ese movimiento; filas antiguas pueden mostrar «—» si no existían esas
          columnas.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:p-6">
        {abonos.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Sin abonos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Capital debitado</TableHead>
                <TableHead className="text-right">Int. recibido</TableHead>
                <TableHead className="text-right">Int. calculado</TableHead>
                <TableHead className="text-right">Dif. pendiente</TableHead>
                <TableHead className="text-right">Saldo capital</TableHead>
                <TableHead>Obs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abonos.map((a, idx) => (
                <TableRow key={a.id != null ? String(a.id) : `abono-${idx}`}>
                  <TableCell className="whitespace-nowrap">
                    {String(a.fecha_abono ?? "—")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(a.total_pagado)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(a.monto_capital_debitado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(a.interes_recibido)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(a.interes_calculado)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(a.diferencia_interes_pendiente)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(a.saldo_capital_restante)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {String(a.observaciones ?? "") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
