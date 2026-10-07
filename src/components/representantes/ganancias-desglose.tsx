"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRD } from "@/lib/format-currency";
import type {
  GananciaMovimiento,
  GananciaPrestamoDetalle,
} from "@/lib/ganancias-representante";
import { cn } from "@/lib/utils";

/**
 * Desglose verificable de las ganancias: una fila por préstamo con el interés
 * realmente cobrado, y al desplegarla los movimientos (abono / interés de
 * período) con sus IDs reales que suman ese interés.
 *
 * Móvil (<md): tarjetas apiladas — sin scroll horizontal.
 * Tablet/escritorio (≥md): tabla, con la cédula y el estado solo a partir de lg.
 */

function movimientoLabel(m: GananciaMovimiento): string {
  return m.tipo === "ABONO" ? `Abono #${m.id}` : `Interés #${m.id}`;
}

function MovimientosList({
  movimientos,
  className,
}: {
  movimientos: GananciaMovimiento[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 duration-200 fill-mode-both",
        className,
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Movimientos de interés cobrado
      </p>
      <ul className="space-y-1.5">
        {movimientos.map((m) => (
          <li
            key={`${m.tipo}-${m.id}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-[10px] font-normal"
              >
                {movimientoLabel(m)}
              </Badge>
              <span className="truncate text-xs text-muted-foreground">
                {m.fecha ?? "—"}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums">
              {formatRD(m.interesPagado)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TasaBadge({ fila }: { fila: GananciaPrestamoDetalle }) {
  return (
    <Badge
      variant={fila.comisionable ? "secondary" : "outline"}
      className="tabular-nums"
    >
      {fila.tasa}%{fila.comisionable ? ` → ${fila.comision}% del interés` : ""}
    </Badge>
  );
}

export function GananciasDesglose({
  detalle,
}: {
  detalle: GananciaPrestamoDetalle[];
}) {
  const [expandidos, setExpandidos] = useState<number[]>([]);

  const toggle = useCallback((prestamoId: number) => {
    setExpandidos((prev) =>
      prev.includes(prestamoId)
        ? prev.filter((id) => id !== prestamoId)
        : [...prev, prestamoId],
    );
  }, []);

  if (detalle.length === 0) return null;

  return (
    <div className="min-w-0">
      {/* ── Móvil (<768 px) — tarjetas ── */}
      <ul className="space-y-2.5 md:hidden">
        {detalle.map((fila, idx) => {
          const abierto = expandidos.includes(fila.prestamoId);
          return (
            <li
              key={fila.prestamoId}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both rounded-xl border border-border/60 bg-card/70 p-3.5 shadow-sm duration-300"
              style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {fila.clienteNombre}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    Cliente #{fila.clienteId} · Préstamo #{fila.prestamoId}
                  </p>
                </div>
                <TasaBadge fila={fila} />
              </div>

              <dl className="mt-3 space-y-1.5 border-t border-border/50 pt-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Interés pagado
                  </dt>
                  <dd className="text-sm tabular-nums">
                    {formatRD(fila.interesPagado)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    Ganancia
                  </dt>
                  <dd
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      fila.comisionable
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatRD(fila.ganancia)}
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 w-full justify-center px-2 text-xs"
                aria-expanded={abierto}
                onClick={() => toggle(fila.prestamoId)}
              >
                <ChevronDown
                  className={cn(
                    "mr-1.5 size-3.5 transition-transform duration-200",
                    abierto && "rotate-180",
                  )}
                />
                {fila.movimientos.length} movimiento
                {fila.movimientos.length === 1 ? "" : "s"}
              </Button>

              {abierto && (
                <MovimientosList
                  movimientos={fila.movimientos}
                  className="mt-2 border-t border-border/50 pt-2.5"
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Tablet / escritorio (≥768 px) — tabla ── */}
      <div className="hidden md:block">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Préstamo</TableHead>
              <TableHead className="w-28">Tasa</TableHead>
              <TableHead className="text-right">Interés pagado</TableHead>
              <TableHead className="text-right">Ganancia</TableHead>
              <TableHead className="w-[3rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalle.map((fila) => {
              const abierto = expandidos.includes(fila.prestamoId);
              return (
                <Fragment key={fila.prestamoId}>
                  <TableRow className="table-row-hover">
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate font-medium">
                        {fila.clienteNombre}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground lg:hidden">
                        Préstamo #{fila.prestamoId}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{fila.prestamoId}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {fila.estado}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TasaBadge fila={fila} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRD(fila.interesPagado)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        fila.comisionable
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatRD(fila.ganancia)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-expanded={abierto}
                        aria-label={`Ver movimientos del préstamo #${fila.prestamoId}`}
                        onClick={() => toggle(fila.prestamoId)}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform duration-200",
                            abierto && "rotate-180",
                          )}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {abierto && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="py-3">
                        <MovimientosList movimientos={fila.movimientos} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
