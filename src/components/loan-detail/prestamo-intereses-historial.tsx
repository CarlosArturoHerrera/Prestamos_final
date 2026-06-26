"use client"

import type { ReactNode } from "react"
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
import {
  type CardField,
  ResponsiveHistoryCardList,
} from "./responsive-history-card-list"

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

// Module-level field definitions — value functions may return JSX.
const FIELDS: CardField[] = [
  {
    label: "Período",
    value: (r) => String(r.fecha_periodo ?? r.fecha_generado ?? "—"),
    valueClassName: "tabular-nums",
  },
  {
    label: "Estado",
    value: (r): ReactNode => {
      const estado = String(r.estado ?? "").toUpperCase()
      const isPendiente = estado === "PENDIENTE"
      return (
        <span
          className={cn(
            "font-semibold",
            isPendiente && "text-amber-700 dark:text-amber-500",
          )}
        >
          {estadoLabel(estado)}
        </span>
      )
    },
  },
  {
    label: "Generado",
    value: (r) => num(r.interes_generado ?? r.monto),
    valueClassName: "tabular-nums",
  },
  {
    label: "Pagado",
    value: (r) => num(r.interes_pagado),
    valueClassName: "tabular-nums",
  },
  {
    label: "Pendiente",
    value: (r): ReactNode => {
      const estado = String(r.estado ?? "").toUpperCase()
      const isPendiente = estado === "PENDIENTE"
      return (
        <span
          className={cn(
            "tabular-nums font-medium",
            isPendiente && "text-amber-700 dark:text-amber-500",
          )}
        >
          {num(r.interes_pendiente ?? r.monto)}
        </span>
      )
    },
  },
]

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
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">Intereses por período</CardTitle>
          <CardDescription className="mt-1">
            Intereses generados por período, que pueden ser pagados, capitalizados o eliminados.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 self-start"
          disabled={applyingIntereses || pendientes.length === 0}
          onClick={() => onAplicarIntereses()}
        >
          {applyingIntereses ? "Aplicando…" : "Aplicar todos al capital"}
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {intereses.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Sin registros de interés por período.
          </p>
        ) : (
          <>
            {/* ── Móvil (<768 px) — tarjetas ── */}
            <ResponsiveHistoryCardList
              records={intereses}
              fields={FIELDS}
              rowKey={(r, i) => (r.id != null ? String(r.id) : `int-${i}`)}
              actions={(record, _idx) => {
                const id = Number(record.id)
                const estado = String(record.estado ?? "").toUpperCase()
                const esPendiente = estado === "PENDIENTE"
                if (!esPendiente || !Number.isFinite(id)) return null
                return (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      disabled={applyingIntereses}
                      onClick={() => onAplicarIntereses([id])}
                    >
                      Al capital
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => onMarcarInteresPagado(id)}
                    >
                      Pagado
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs text-destructive"
                      onClick={() => onAnularInteres(id)}
                    >
                      Anular
                    </Button>
                  </>
                )
              }}
            />

            {/* ── Tablet / escritorio (≥768 px) — tabla ── */}
            <div className="hidden md:block">
              {/*
               * md (768-1023 px): 4 columnas (Período, Estado, Pendiente, Acciones).
               * lg+ (≥1024 px): todas las columnas.
               */}
              <Table className="min-w-[380px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      Generado
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      Pagado
                    </TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead className="w-[200px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intereses.map((i, idx) => {
                    const id = Number(i.id)
                    const estado = String(i.estado ?? "").toUpperCase()
                    const esPendiente = estado === "PENDIENTE"
                    return (
                      <TableRow
                        key={i.id != null ? String(i.id) : `int-${idx}`}
                      >
                        <TableCell className="whitespace-nowrap">
                          {String(i.fecha_periodo ?? i.fecha_generado ?? "—")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              esPendiente &&
                                "text-amber-700 dark:text-amber-500",
                            )}
                          >
                            {estadoLabel(estado)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">
                          {num(i.interes_generado ?? i.monto)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">
                          {num(i.interes_pagado)}
                        </TableCell>
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
