"use client"

import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

type Props = {
  intereses: Record<string, unknown>[]
  applyingIntereses: boolean
  onAplicarIntereses: (ids?: number[]) => void | Promise<void>
  onMarcarInteresPagado: (interesId: number) => void | Promise<void>
  onAnularInteres: (interesId: number) => void | Promise<void>
}

function num(v: unknown): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (Number.isNaN(n)) return "—"
  return formatRD(n)
}

function estadoLabel(estado: string): string {
  const u = estado.toUpperCase()
  if (u === "PENDIENTE") return "Pendiente"
  if (u === "PAGADO") return "Pagado"
  if (u === "CAPITALIZADO") return "Capitalizado"
  if (u === "ANULADO") return "Anulado"
  return estado || "—"
}

export function PrestamoInteresesHistorial({
  intereses,
  applyingIntereses,
  onAplicarIntereses,
  onMarcarInteresPagado,
  onAnularInteres,
}: Props) {
  const pendientes = intereses.filter(
    (i) => String(i.estado ?? "").toUpperCase() === "PENDIENTE",
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Intereses por período</CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            Generadas por cada fecha de pago. Si pasan más de 3 días desde el período sin cubrir el interés,
            al abrir este detalle puede capitalizarse automáticamente al capital (origen AUTO). Puedes
            capitalizar manualmente, marcar como pagado o anular.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={applyingIntereses || pendientes.length === 0}
          onClick={() => onAplicarIntereses()}
        >
          {applyingIntereses ? "Aplicando…" : "Aplicar todos al capital"}
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:p-6">
        {intereses.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Sin registros de interés por período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Generado</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right w-[200px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intereses.map((i, idx) => {
                const id = Number(i.id)
                const estado = String(i.estado ?? "").toUpperCase()
                const esPendiente = estado === "PENDIENTE"
                return (
                  <TableRow key={i.id != null ? String(i.id) : `int-${idx}`}>
                    <TableCell className="whitespace-nowrap">
                      {String(i.fecha_periodo ?? i.fecha_generado ?? "—")}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          esPendiente && "text-amber-700 dark:text-amber-500",
                        )}
                      >
                        {estadoLabel(estado)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(i.interes_generado ?? i.monto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(i.interes_pagado)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(i.interes_pendiente ?? i.monto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {esPendiente && Number.isFinite(id) ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            disabled={applyingIntereses}
                            onClick={() => onAplicarIntereses([id])}
                          >
                            Al capital
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => onMarcarInteresPagado(id)}
                          >
                            Pagado
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-destructive"
                            onClick={() => onAnularInteres(id)}
                          >
                            Anular
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
