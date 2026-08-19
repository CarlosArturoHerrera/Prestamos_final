"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GestionCobranzaPanel } from "@/components/gestion-cobranza-panel";
import { PrestamoAbonosHistorial } from "@/components/loan-detail/prestamo-abonos-historial";
import { PrestamoInteresesHistorial } from "@/components/loan-detail/prestamo-intereses-historial";
import { PrestamoReganchesHistorial } from "@/components/loan-detail/prestamo-reganches-historial";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useInView } from "@/hooks/use-in-view";
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api";
import { interesPeriodo } from "@/lib/finance";
import { formatCedula } from "@/lib/formatters";
import { formatRD } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

function estBadgeVariant(
  estado: string,
): "default" | "secondary" | "destructive" | "outline" {
  const u = estado.toUpperCase();
  if (u === "MORA") return "destructive";
  if (u === "SALDADO") return "secondary";
  return "default";
}

type PrestamoDetalleData = {
  prestamo: Record<string, unknown>;
  abonos: Record<string, unknown>[];
  intereses_atrasados: Record<string, unknown>[];
  reganches: Record<string, unknown>[];
};

type PrestamoAgregados = {
  totalAbonado: number;
  interesPendienteAcumulado: number;
  capAuto: number;
  capManual: number;
  otrosReg: number;
};

type AbonoFormValues = {
  fechaAbono: string;
  /** Monto único recibido: cubre primero el interés y el excedente va al capital. */
  montoRecibido: string;
  observaciones: string;
};

/**
 * Reparte el monto recibido: primero cubre el interés del período y, solo si
 * sobra, el excedente se aplica como abono al capital.
 */
function repartirMontoRecibido(
  montoRecibido: string,
  interesCalculado: string,
) {
  const monto = new Decimal(montoRecibido || "0");
  const interes = new Decimal(interesCalculado || "0");
  const interesPagado = Decimal.min(monto, interes);
  const capitalDebitado = Decimal.max(new Decimal(0), monto.minus(interes));
  return {
    interesPagado: interesPagado.toFixed(2),
    capitalDebitado: capitalDebitado.toFixed(2),
  };
}

type RegancheFormValues = {
  monto: string;
  notas: string;
};

const LoanHeader = memo(function LoanHeader({
  id,
  estadoStr,
  cliente,
}: {
  id: number;
  estadoStr: string;
  cliente:
    | {
        nombre?: string;
        apellido?: string;
        cedula?: string;
        empresas?: { nombre?: string };
        representantes?: { nombre?: string; apellido?: string };
      }
    | undefined;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/prestamos">← Volver</Link>
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Préstamo de{" "}
              {cliente
                ? `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim()
                : `#${id}`}
            </h1>
            <Badge variant={estBadgeVariant(estadoStr)} className="text-sm">
              {estadoStr}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cédula: {formatCedula(cliente?.cedula ?? "")} · Empresa:{" "}
            {cliente?.empresas?.nombre ?? "—"} · Representante:{" "}
            {cliente?.representantes
              ? `${cliente.representantes.nombre ?? ""} ${cliente.representantes.apellido ?? ""}`.trim()
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
});

const ResumenFinanciero = memo(function ResumenFinanciero({
  p,
  agregados,
  interesCalculadoPeriodo,
}: {
  p: Record<string, unknown>;
  agregados: PrestamoAgregados | null;
  interesCalculadoPeriodo: string;
}) {
  if (!agregados) return null;
  return (
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
          <p className="mt-1 text-xs text-muted-foreground">
            Saldo actual del principal por liquidar
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Interés del período
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatRD(interesCalculadoPeriodo)}
          </p>
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
              agregados.interesPendienteAcumulado > 0 &&
                "text-amber-700 dark:text-amber-400",
            )}
          >
            {formatRD(agregados.interesPendienteAcumulado)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Suma de períodos en estado Pendiente
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total abonado
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatRD(agregados.totalAbonado)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Suma de «Total» en movimientos de abono
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Interés capitalizado al principal
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <Badge variant="default">AUTO</Badge>
              <span className="text-lg font-semibold tabular-nums">
                {formatRD(agregados.capAuto)}
              </span>
            </span>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="inline-flex items-center gap-2">
              <Badge variant="secondary">MANUAL</Badge>
              <span className="text-lg font-semibold tabular-nums">
                {formatRD(agregados.capManual)}
              </span>
            </span>
            {agregados.otrosReg > 0 && (
              <>
                <Separator
                  orientation="vertical"
                  className="hidden h-6 md:block"
                />
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
  );
});

const RegancheFormCard = memo(function RegancheFormCard({
  onSubmit,
}: {
  onSubmit: (values: RegancheFormValues) => Promise<boolean>;
}) {
  const [form, setForm] = useState<RegancheFormValues>({
    monto: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSubmit(form);
    if (ok) setForm({ monto: "", notas: "" });
    setSaving(false);
  }, [form, onSubmit, saving]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reganche</CardTitle>
        <CardDescription>Carga adicional al capital pendiente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Monto a agregar al capital pendiente</Label>
          <CurrencyInput
            value={form.monto}
            onChange={(raw) => setForm((prev) => ({ ...prev, monto: raw }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Notas</Label>
          <Input
            value={form.notas}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, notas: e.target.value }))
            }
          />
        </div>
        <Button onClick={submit} className="w-full sm:w-auto" disabled={saving}>
          {saving ? "Aplicando..." : "Aplicar reganche"}
        </Button>
      </CardContent>
    </Card>
  );
});

const RegistrarAbonoCard = memo(function RegistrarAbonoCard({
  prestamoId,
  cliente,
  capitalPendiente,
  interesCalculadoPeriodo,
  saldado,
  onSubmit,
  onSaldar,
}: {
  prestamoId: number;
  cliente: string;
  capitalPendiente: string;
  interesCalculadoPeriodo: string;
  saldado: boolean;
  onSubmit: (values: AbonoFormValues) => Promise<boolean>;
  onSaldar: () => Promise<void>;
}) {
  const [form, setForm] = useState<AbonoFormValues>({
    fechaAbono: new Date().toISOString().slice(0, 10),
    montoRecibido: "",
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmarSaldar, setConfirmarSaldar] = useState(false);
  const [saldando, setSaldando] = useState(false);

  // Vista previa de lo que se pagará. Es orientativa: el servidor recalcula
  // sobre el estado real del préstamo en el momento de ejecutar.
  const totalASaldar = useMemo(() => {
    try {
      return new Decimal(capitalPendiente || "0")
        .plus(interesCalculadoPeriodo || "0")
        .toFixed(2);
    } catch {
      return "0.00";
    }
  }, [capitalPendiente, interesCalculadoPeriodo]);

  const desglose = useMemo(() => {
    if (!form.montoRecibido.trim()) return null;
    try {
      return repartirMontoRecibido(form.montoRecibido, interesCalculadoPeriodo);
    } catch {
      return null;
    }
  }, [form.montoRecibido, interesCalculadoPeriodo]);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSubmit(form);
    if (ok) {
      setForm((prev) => ({
        ...prev,
        montoRecibido: "",
        observaciones: "",
      }));
    }
    setSaving(false);
  }, [form, onSubmit, saving]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar abono</CardTitle>
        <CardDescription>
            Interes calculado en el período:{" "}
          <span className="font-medium text-foreground">
            {formatRD(interesCalculadoPeriodo)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <CalendarDatePicker
              value={form.fechaAbono}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, fechaAbono: value }))
              }
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label>Monto recibido</Label>
            <CurrencyInput
              value={form.montoRecibido}
              onChange={(raw) =>
                setForm((prev) => ({
                  ...prev,
                  montoRecibido: raw,
                }))
              }
              placeholder="Monto total que pagó el cliente"
            />
            <p className="text-xs text-muted-foreground leading-snug">
              Cubre primero el interés del período; el excedente se abona
              automáticamente al capital.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input
              value={form.observaciones}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, observaciones: e.target.value }))
              }
            />
          </div>
        </div>
        {desglose ? (
          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Interés pagado</span>
              <span className="font-medium tabular-nums">
                {formatRD(desglose.interesPagado)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Capital debitado</span>
              <span className="font-medium tabular-nums">
                {formatRD(desglose.capitalDebitado)}
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={submit}
            disabled={saving || saldando}
            className="w-full sm:w-auto"
          >
            {saving ? "Registrando..." : "Registrar abono"}
          </Button>
          <Button
            type="button"
            onClick={() => setConfirmarSaldar(true)}
            disabled={saving || saldando || saldado}
            className={cn(
              "w-full sm:w-auto",
              // Mismo tratamiento que el botón principal —degradado, sombra y
              // elevación al hover— en el ámbar que el módulo ya usa para
              // señalar atención.
              "from-[#D97706] to-[#B45309] shadow-[0_2px_8px_rgba(180,83,9,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]",
              "hover:shadow-[0_6px_20px_rgba(180,83,9,0.45)]",
              "active:shadow-[0_1px_4px_rgba(180,83,9,0.25)]",
              "focus-visible:ring-amber-500/45",
              // En oscuro se aclara el ámbar y el texto pasa a ser oscuro, que
              // es como el módulo trata los fondos ámbar intensos.
              "dark:from-[#FBBF24] dark:to-[#F59E0B] dark:text-amber-950",
              "dark:shadow-[0_2px_14px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.22)]",
              "dark:hover:shadow-[0_6px_24px_rgba(251,191,36,0.5)]",
            )}
          >
            {saldando ? "Saldando..." : "Saldar"}
          </Button>
        </div>
      </CardContent>

      <AlertDialog
        open={confirmarSaldar}
        onOpenChange={(abierto) => {
          // Cerrar a media petición dejaría el estado de carga colgado.
          if (saldando) return;
          setConfirmarSaldar(abierto);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Saldar préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción realizará automáticamente los abonos necesarios para
              cubrir el total pendiente del préstamo y marcarlo como saldado.
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Identifica el préstamo concreto y lo que se va a pagar, para que
              la confirmación no sea un «sí» a ciegas. */}
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
            <p className="font-medium">
              Préstamo #{prestamoId}
              {cliente ? ` · ${cliente}` : ""}
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Interés del período
                </span>
                <span className="tabular-nums">
                  {formatRD(interesCalculadoPeriodo)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Capital pendiente</span>
                <span className="tabular-nums">
                  {formatRD(capitalPendiente)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-1 text-sm font-semibold">
                <span>Total a saldar</span>
                <span className="tabular-nums">{formatRD(totalASaldar)}</span>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saldando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saldando}
              onClick={(e) => {
                // El diálogo cierra por defecto al pulsar; hay que evitarlo
                // para poder mostrar el estado de carga.
                e.preventDefault();
                void (async () => {
                  if (saldando) return;
                  setSaldando(true);
                  await onSaldar();
                  setSaldando(false);
                  setConfirmarSaldar(false);
                })();
              }}
            >
              {saldando ? "Saldando..." : "Aceptar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
});

export default function PrestamoDetallePage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<PrestamoDetalleData | null>(null);
  const [applyingIntereses, setApplyingIntereses] = useState(false);
  const { ref: interesesRef, inView: interesesInView } =
    useInView<HTMLDivElement>({ rootMargin: "250px" });
  const { ref: reganchesRef, inView: reganchesInView } =
    useInView<HTMLDivElement>({ rootMargin: "250px" });
  const { ref: abonosRef, inView: abonosInView } = useInView<HTMLDivElement>({
    rootMargin: "250px",
  });

  const load = useCallback(async () => {
    const res = await fetchApi<PrestamoDetalleData>(`/api/prestamos/${id}`);
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      return;
    }
    setData(res.data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateInteresLocal = useCallback(
    (interesId: number, patch: Partial<Record<string, unknown>>) => {
      setData((prev) => {
        if (!prev) return prev;
        const updatedIntereses = (prev.intereses_atrasados ?? []).map((i) =>
          Number(i.id) === interesId ? { ...i, ...patch } : i,
        );
        return { ...prev, intereses_atrasados: updatedIntereses };
      });
    },
    [],
  );

  const prestamoResumen = data?.prestamo;
  const interesCalculadoPeriodo = useMemo(() => {
    if (!prestamoResumen) return "0.00";
    try {
      return interesPeriodo(
        String(prestamoResumen.capital_pendiente ?? "0"),
        String(prestamoResumen.tasa_interes ?? "0"),
      );
    } catch {
      return "0.00";
    }
  }, [
    prestamoResumen,
    prestamoResumen?.capital_pendiente,
    prestamoResumen?.tasa_interes,
  ]);

  /** Delega en `/saldar`, que reutiliza el propio handler de abonos. */
  const saldarPrestamo = useCallback(async () => {
    const res = await fetchApi(`/api/prestamos/${id}/saldar`, {
      method: "POST",
    });
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      return;
    }
    toast.success("Préstamo saldado");
    await load();
  }, [id, load]);

  const registrarAbono = useCallback(
    async (abonoForm: AbonoFormValues) => {
      const monto = Number(abonoForm.montoRecibido);
      if (!abonoForm.montoRecibido.trim() || !Number.isFinite(monto)) {
        toast.error("Indica el monto recibido");
        return false;
      }
      if (monto < 0) {
        toast.error("El monto recibido no puede ser negativo");
        return false;
      }
      const { interesPagado, capitalDebitado } = repartirMontoRecibido(
        abonoForm.montoRecibido,
        interesCalculadoPeriodo,
      );
      const res = await fetchApi(`/api/prestamos/${id}/abonos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaAbono: abonoForm.fechaAbono,
          interesRecibido: interesPagado,
          montoCapitalDebitado: capitalDebitado,
          observaciones: abonoForm.observaciones,
        }),
      });
      if (!res.ok) {
        redirectToLoginIfUnauthorized(res.status);
        toast.error(res.message);
        return false;
      }
      toast.success("Abono registrado");
      await load();
      return true;
    },
    [id, load, interesCalculadoPeriodo],
  );

  const reganche = useCallback(
    async (regancheForm: RegancheFormValues) => {
      const r = await fetch(`/api/prestamos/${id}/reganche`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montoAgregado: regancheForm.monto,
          notas: regancheForm.notas || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? "Error");
        return false;
      }
      toast.success("Reganche aplicado al mismo préstamo");
      await load();
      return true;
    },
    [id, load],
  );

  const aplicarIntereses = useCallback(
    async (ids?: number[]) => {
      const ok = window.confirm(
        ids?.length
          ? "¿Aplicar este interés pendiente al capital del préstamo?"
          : "¿Aplicar TODOS los intereses pendientes al capital del préstamo?",
      );
      if (!ok) return;
      if (applyingIntereses) return;
      setApplyingIntereses(true);
      const res = await fetchApi(
        `/api/prestamos/${id}/aplicar-interes-atrasado`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids?.length ? { ids } : {}),
        },
      );
      if (!res.ok) {
        redirectToLoginIfUnauthorized(res.status);
        toast.error(res.message);
        setApplyingIntereses(false);
        return;
      }
      toast.success("Intereses aplicados al capital");
      await load();
      setApplyingIntereses(false);
    },
    [applyingIntereses, id, load],
  );

  const marcarInteresPagado = useCallback(
    async (interesId: number) => {
      const ok = window.confirm(
        "¿Marcar este interés pendiente como pagado (sin capitalizar)?",
      );
      if (!ok) return;
      const res = await fetchApi(
        `/api/prestamos/${id}/intereses-atrasados/${interesId}/marcar-pagado`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        redirectToLoginIfUnauthorized(res.status);
        toast.error(res.message);
        return;
      }
      const hoy = new Date().toISOString().slice(0, 10);
      updateInteresLocal(interesId, {
        estado: "PAGADO",
        interes_pendiente: "0.00",
        monto: "0.00",
        aplicado: false,
        fecha_aplicado: hoy,
      });
      toast.success("Interés marcado como pagado");
    },
    [id, updateInteresLocal],
  );

  const anularInteres = useCallback(
    async (interesId: number) => {
      const ok = window.confirm(
        "¿Seguro que deseas anular este interés pendiente?",
      );
      if (!ok) return;
      const res = await fetchApi(
        `/api/prestamos/${id}/intereses-atrasados/${interesId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        redirectToLoginIfUnauthorized(res.status);
        toast.error(res.message);
        return;
      }
      updateInteresLocal(interesId, {
        estado: "ANULADO",
        interes_pendiente: "0.00",
        monto: "0.00",
        aplicado: false,
        fecha_aplicado: null,
      });
      toast.success("Interés pendiente anulado");
    },
    [id, updateInteresLocal],
  );

  const agregados = useMemo(() => {
    if (!data) return null;
    const abonos = data.abonos ?? [];
    const intereses = data.intereses_atrasados ?? [];
    const reganches = data.reganches ?? [];
    const totalAbonado = abonos.reduce(
      (s, a) => s + Number(a.total_pagado ?? 0),
      0,
    );
    const interesPendienteAcumulado = intereses
      .filter((i) => String(i.estado ?? "").toUpperCase() === "PENDIENTE")
      .reduce((s, i) => s + Number(i.interes_pendiente ?? i.monto ?? 0), 0);
    let capAuto = 0;
    let capManual = 0;
    let otrosReg = 0;
    for (const r of reganches) {
      const n = String(r.notas ?? "");
      const m = Number(r.monto_agregado ?? 0);
      if (n.startsWith("AUTO:")) capAuto += m;
      else if (n.startsWith("MANUAL:")) capManual += m;
      else otrosReg += m;
    }
    return {
      totalAbonado,
      interesPendienteAcumulado,
      capAuto,
      capManual,
      otrosReg,
    };
  }, [data]);

  if (!data?.prestamo) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const p = data.prestamo;
  const estadoStr = String(p.estado ?? "");
  const cliente = p.clientes as
    | {
        nombre?: string;
        apellido?: string;
        cedula?: string;
        empresas?: { nombre?: string };
        representantes?: { nombre?: string; apellido?: string };
      }
    | undefined;

  return (
    <div className="space-y-8">
      <LoanHeader id={id} estadoStr={estadoStr} cliente={cliente} />
      <ResumenFinanciero
        p={p}
        agregados={agregados}
        interesCalculadoPeriodo={interesCalculadoPeriodo}
      />

      {p.cliente_id != null ? (
        <GestionCobranzaPanel
          clienteId={Number(p.cliente_id)}
          prestamoId={id}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Condiciones del préstamo
            </CardTitle>
            <CardDescription>Datos del contrato y calendario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">
                Capital inicial / acumulado
              </span>
              <span className="font-medium tabular-nums">
                {formatRD(p.monto as string)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Tasa (por período)</span>
              <span className="font-medium">{String(p.tasa_interes)}%</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">Capital a debitar</span>
              <span className="font-medium tabular-nums">
                {formatRD(String(p.capital_a_debitar ?? "0"))}
              </span>
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
              <span className="font-medium">
                {String(p.fecha_proximo_vencimiento)}
              </span>
            </div>
          </CardContent>
        </Card>
        <RegancheFormCard onSubmit={reganche} />
      </div>
      <RegistrarAbonoCard
        prestamoId={id}
        cliente={
          cliente
            ? `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim()
            : ""
        }
        capitalPendiente={String(p.capital_pendiente ?? "0")}
        interesCalculadoPeriodo={interesCalculadoPeriodo}
        saldado={estadoStr.toUpperCase() === "SALDADO"}
        onSubmit={registrarAbono}
        onSaldar={saldarPrestamo}
      />

      <div ref={interesesRef}>
        {interesesInView ? (
          <PrestamoInteresesHistorial
            intereses={
              (data.intereses_atrasados ?? []) as Record<string, unknown>[]
            }
            applyingIntereses={applyingIntereses}
            onAplicarIntereses={aplicarIntereses}
            onMarcarInteresPagado={marcarInteresPagado}
            onAnularInteres={anularInteres}
          />
        ) : (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  Intereses por período
                </CardTitle>
                <CardDescription className="mt-1">
                  Generadas por cada fecha de pago. Si pasan más de 3 días desde
                  el período sin cubrir el interés, al abrir este detalle puede
                  capitalizarse automáticamente al capital (origen AUTO). Puedes
                  capitalizar manualmente, marcar como pagado o anular.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 self-start"
                disabled
              >
                Aplicar todos al capital
              </Button>
            </CardHeader>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Cargando historial de intereses...
            </CardContent>
          </Card>
        )}
      </div>

      <div ref={reganchesRef}>
        {reganchesInView ? (
          <PrestamoReganchesHistorial
            reganches={(data.reganches ?? []) as Record<string, unknown>[]}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Historial de reganches
              </CardTitle>
              <CardDescription>
                Aumentos al capital: reganche manual (formulario) o
                capitalización de interés (AUTO / MANUAL).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Cargando historial de reganches...
            </CardContent>
          </Card>
        )}
      </div>

      <div ref={abonosRef}>
        {abonosInView ? (
          <PrestamoAbonosHistorial
            abonos={(data.abonos ?? []) as Record<string, unknown>[]}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de abonos</CardTitle>
              <CardDescription>
                El capital pendiente solo baja por «Capital debitado». La
                columna «Dif. a pendiente» refleja el interés no cubierto en ese
                movimiento; filas antiguas pueden mostrar «—» si no existían
                esas columnas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Cargando historial de abonos...
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
