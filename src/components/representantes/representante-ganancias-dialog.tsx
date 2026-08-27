"use client";

import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { motion } from "framer-motion";
import { Coins, Percent, TrendingUp, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GananciasDesglose } from "@/components/representantes/ganancias-desglose";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api";
import { formatRD } from "@/lib/format-currency";
import type {
  GananciaPorTasa,
  GananciaPrestamoDetalle,
} from "@/lib/ganancias-representante";
import { stagger, staggerChild } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Ganancias del representante (Acciones → Ganancias).
 * Solo consulta: `/api/representantes/[id]/ganancias` calcula la comisión sobre
 * el interés que los clientes asignados pagaron realmente.
 */

export type GananciasResponse = {
  representante: {
    id: number;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
  };
  periodo: { desde: string | null; hasta: string | null };
  comisiones: ReadonlyArray<{ tasa: string; comision: string }>;
  clientesAsignados: number;
  prestamosRevisados: number;
  totales: {
    interesPagado: string;
    ganancia: string;
    clientesConGanancia: number;
    prestamosConGanancia: number;
  };
  porTasa: GananciaPorTasa[];
  detalle: GananciaPrestamoDetalle[];
};

type Preset = "TODO" | "HOY" | "SEMANA" | "MES" | "PERSONALIZADO";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "TODO", label: "Todo" },
  { value: "HOY", label: "Hoy" },
  { value: "SEMANA", label: "Esta semana" },
  { value: "MES", label: "Este mes" },
  { value: "PERSONALIZADO", label: "Personalizado" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function rangoDePreset(
  preset: Preset,
  custom: { from?: string; to?: string },
): { desde?: string; hasta?: string } {
  const hoy = new Date();
  switch (preset) {
    case "HOY":
      return { desde: iso(hoy), hasta: iso(hoy) };
    case "SEMANA":
      return {
        desde: iso(startOfWeek(hoy, { weekStartsOn: 1 })),
        hasta: iso(endOfWeek(hoy, { weekStartsOn: 1 })),
      };
    case "MES":
      return { desde: iso(startOfMonth(hoy)), hasta: iso(endOfMonth(hoy)) };
    case "PERSONALIZADO":
      return { desde: custom.from, hasta: custom.to };
    default:
      return {};
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  destacado,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        destacado
          ? "border-primary/30 bg-primary/[0.06]"
          : "border-border/70 bg-card/70",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon
          className={cn("size-3.5", destacado ? "text-primary" : "opacity-70")}
        />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 break-words text-xl font-bold tabular-nums sm:text-2xl",
          destacado && "text-primary",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function TasaCard({ fila }: { fila: GananciaPorTasa }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Percent className="size-3.5 text-primary" />
          Préstamos al {fila.tasa}%
        </span>
        <Badge variant="secondary" className="tabular-nums">
          comisión {fila.comisionTasa}%
        </Badge>
      </div>
      <dl className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">Interés pagado</dt>
          <dd className="text-sm tabular-nums">
            {formatRD(fila.interesPagado)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">Ganancia</dt>
          <dd className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatRD(fila.ganancia)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">
            Clientes / préstamos
          </dt>
          <dd className="text-sm tabular-nums">
            {fila.clientes} / {fila.prestamos}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function GananciasSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card/70 p-3.5"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-border/70 bg-card/70 p-3.5"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RepresentanteGananciasDialog({
  representanteId,
  nombreCompleto,
  onOpenChange,
}: {
  /** `null` mantiene el diálogo cerrado. */
  representanteId: number | null;
  nombreCompleto: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [preset, setPreset] = useState<Preset>("TODO");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [data, setData] = useState<GananciasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = representanteId !== null;

  // Cada representante arranca con el período por defecto y sin datos previos.
  // Ajuste en render (no en efecto) para que la primera carga ya use el estado limpio.
  const [ultimoId, setUltimoId] = useState<number | null>(representanteId);
  if (representanteId !== ultimoId) {
    setUltimoId(representanteId);
    setPreset("TODO");
    setCustom({});
    setData(null);
    setError(null);
  }

  const load = useCallback(async () => {
    if (representanteId === null) return;
    setLoading(true);
    setError(null);
    const { desde, hasta } = rangoDePreset(preset, custom);
    const q = new URLSearchParams();
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    const suffix = q.toString() ? `?${q}` : "";
    const res = await fetchApi<GananciasResponse>(
      `/api/representantes/${representanteId}/ganancias${suffix}`,
    );
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      setData(null);
      setError(res.message);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, [representanteId, preset, custom]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const comisionables = useMemo(
    () => (data?.porTasa ?? []).filter((t) => t.comisionable),
    [data],
  );
  const otrasTasas = useMemo(
    () => (data?.porTasa ?? []).filter((t) => !t.comisionable),
    [data],
  );

  const periodoLabel = useMemo(() => {
    const { desde, hasta } = rangoDePreset(preset, custom);
    if (!desde && !hasta) return "Histórico completo";
    if (desde && hasta) return `${desde} → ${hasta}`;
    return desde ? `Desde ${desde}` : `Hasta ${hasta}`;
  }, [preset, custom]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          className="max-h-[92vh] gap-4 p-4 sm:max-w-3xl sm:p-6"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
              <TrendingUp className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">
                Ganancias ·{" "}
                {data?.representante.nombreCompleto ?? nombreCompleto}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* ── Período ── */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={preset === p.value ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setPreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {preset === "PERSONALIZADO" && (
              <CalendarDatePicker
                mode="range"
                range={custom}
                onRangeChange={setCustom}
                placeholder="Seleccionar rango de fechas"
                className="w-full sm:w-auto"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Período: {periodoLabel}
            </p>
          </div>

          {loading && !data ? (
            <GananciasSkeleton />
          ) : error ? (
            <EmptyState
              icon={Coins}
              title="No se pudieron cargar las ganancias"
              description={error}
            >
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Reintentar
              </Button>
            </EmptyState>
          ) : data ? (
            <div
              className={cn(
                "min-w-0 space-y-5",
                loading && "opacity-60 transition-opacity duration-200",
              )}
            >
              {/* ── Totales ── */}
              <motion.div
                className="grid gap-3 sm:grid-cols-3"
                variants={stagger(0.05)}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={staggerChild}>
                  <StatCard
                    icon={Wallet}
                    label="Interés pagado por clientes"
                    value={formatRD(data.totales.interesPagado)}
                    hint={`${data.totales.prestamosConGanancia} préstamo${
                      data.totales.prestamosConGanancia === 1 ? "" : "s"
                    } con comisión`}
                  />
                </motion.div>
                <motion.div variants={staggerChild}>
                  <StatCard
                    icon={Coins}
                    label="Ganancia del representante"
                    value={formatRD(data.totales.ganancia)}
                    hint="Total del desglose"
                    destacado
                  />
                </motion.div>
                <motion.div variants={staggerChild}>
                  <StatCard
                    icon={Users}
                    label="Clientes que generaron"
                    value={String(data.totales.clientesConGanancia)}
                    hint={`de ${data.clientesAsignados} asignado${
                      data.clientesAsignados === 1 ? "" : "s"
                    }`}
                  />
                </motion.div>
              </motion.div>

              {/* ── Desglose por tasa ── */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Desglose por tasa
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {comisionables.map((t) => (
                    <TasaCard key={t.tasa} fila={t} />
                  ))}
                </div>
                {otrasTasas.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Otras tasas sin comisión configurada:{" "}
                    {otrasTasas
                      .map((t) => `${t.tasa}% (${formatRD(t.interesPagado)})`)
                      .join(" · ")}
                    . No generan ganancia.
                  </p>
                )}
              </section>

              {/* ── Detalle verificable ── */}
              <section className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Detalle por cliente y préstamo
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Total: {formatRD(data.totales.ganancia)}
                  </span>
                </div>
                {data.detalle.length === 0 ? (
                  <EmptyState
                    icon={Coins}
                    title="Sin intereses pagados en este período"
                    description="Las ganancias solo se generan cuando el cliente paga el interés. Los intereses pendientes o futuros no cuentan."
                  />
                ) : (
                  <GananciasDesglose detalle={data.detalle} />
                )}
              </section>
            </div>
          ) : null}
        </DialogContent>
      )}
    </Dialog>
  );
}
