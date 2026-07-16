"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Landmark,
  PhoneForwarded,
  PiggyBank,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UserSquare2,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CardGridSkeleton,
  TableSkeleton,
} from "@/components/shared/data-skeleton";
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api";
import { usePageCachedState } from "@/lib/page-cache";
import { formatRD } from "@/lib/format-currency";
import { labelResultadoGestion } from "@/lib/gestion-cobranza";
import { isSupabaseConfiguredOnClient } from "@/lib/env-public";
import { cn } from "@/lib/utils";

type AbonoReciente = {
  id: number;
  fecha_abono: string;
  total_pagado: string | number;
  prestamo_id: number;
  prestamos?: {
    id: number;
    clientes?: { nombre: string; apellido: string } | null;
  } | null;
};

type Stats = {
  clientes_activos: number;
  prestamos_en_mora: number;
  recaudacion_mes: string;
  proximos_vencimientos: {
    id: number;
    fecha_proximo_vencimiento: string;
    capital_pendiente: string | number;
    estado: string;
    clientes: { nombre: string; apellido: string } | null;
  }[];
  abonos_recientes: AbonoReciente[];
};

type ClientesResumen = {
  total: number;
  validados: number;
  pendientesValidacion: number;
};
type EmpresasResumen = { total: number; conRnc: number };
type RepresentantesResumen = {
  totalRepresentantes: number;
  totalClientesVinculados: number;
};

type PrestamosResumen = {
  totalPrestado: string;
  capitalPendiente: string;
  interesPendienteAcumulado: string;
  prestamosMora: number;
  prestamosSaldados: number;
  prestamosActivos: number;
  capitalizacionAuto: string;
  capitalizacionManual: string;
  alertas: {
    vencenProximos7Dias: number;
    enMora: number;
    prestamosConInteresPendiente: number;
    capitalizacionesAutoUltimos7Dias: number;
  };
};

type GestionPendienteRow = {
  id: number;
  cliente_id: number;
  prestamo_id: number | null;
  proxima_fecha_contacto: string | null;
  created_at: string;
  resultado: string;
  clientes: { nombre: string; apellido: string } | null;
  prestamos: { id: number; estado: string; capital_pendiente: string } | null;
};

type GestionPendientesRes = { total: number; items: GestionPendienteRow[] };

type DashboardData = {
  stats: Stats;
  clientes: ClientesResumen;
  empresas: EmpresasResumen;
  representantes: RepresentantesResumen;
  prestamos: PrestamosResumen;
  gestionPendientes: GestionPendientesRes | null;
};

const quickLinks = [
  {
    href: "/clientes?estadoValidacion=PENDIENTE_VALIDAR",
    label: "Clientes por validar",
    desc: "Expedientes pendientes de revisión",
    icon: UserCheck,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40",
  },
  {
    href: "/prestamos?estado=MORA",
    label: "Préstamos en mora",
    desc: "Seguimiento prioritario de cartera",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40",
  },
  {
    href: "/prestamos?conInteresPendiente=true",
    label: "Interés pendiente",
    desc: "Períodos con interés abierto",
    icon: CircleDollarSign,
    color: "text-primary",
    bg: "bg-card border-border",
  },
  {
    href: "/empresas?sinRnc=true",
    label: "Empresas sin RNC",
    desc: "Completar datos fiscales",
    icon: Building2,
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border",
  },
  {
    href: "/representantes?conClientes=true",
    label: "Cartera de representantes",
    desc: "Clientes vinculados activos",
    icon: Users,
    color: "text-primary",
    bg: "bg-card border-border",
  },
  {
    href: "/prestamos",
    label: "Gestión de cobranza",
    desc: "Registra seguimientos y contactos",
    icon: PhoneForwarded,
    color: "text-primary",
    bg: "bg-card border-border",
  },
];

const fade: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  }),
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  index = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
  index?: number;
}) {
  return (
    <motion.div
      className="stat-card"
      custom={index}
      variants={fade}
      initial="hidden"
      animate="show"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tracking-tight tabular",
              accent,
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="metric-icon shrink-0">
          <Icon className="size-4" />
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [data, setData, dataCached] = usePageCachedState<DashboardData | null>(
    "dashboard:data",
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!dataCached);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfiguredOnClient()) {
      setError(
        "Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el despliegue. Configúralas en Vercel y vuelve a publicar.",
      );
      setLoading(false);
      return;
    }

    const [rStats, rCli, rEmp, rRep, rPre, rGestion] = await Promise.all([
      fetchApi<Stats>("/api/dashboard/stats"),
      fetchApi<ClientesResumen>("/api/clientes/resumen"),
      fetchApi<EmpresasResumen>("/api/empresas/resumen"),
      fetchApi<RepresentantesResumen>("/api/representantes/resumen"),
      fetchApi<PrestamosResumen>("/api/prestamos/resumen"),
      fetchApi<GestionPendientesRes>("/api/dashboard/gestion-pendientes"),
    ]);

    if (!rStats.ok) {
      redirectToLoginIfUnauthorized(rStats.status);
      setError(rStats.message);
      setLoading(false);
      return;
    }
    if (!rCli.ok) {
      redirectToLoginIfUnauthorized(rCli.status);
      setError(rCli.message);
      setLoading(false);
      return;
    }
    if (!rEmp.ok) {
      redirectToLoginIfUnauthorized(rEmp.status);
      setError(rEmp.message);
      setLoading(false);
      return;
    }
    if (!rRep.ok) {
      redirectToLoginIfUnauthorized(rRep.status);
      setError(rRep.message);
      setLoading(false);
      return;
    }
    if (!rPre.ok) {
      redirectToLoginIfUnauthorized(rPre.status);
      setError(rPre.message);
      setLoading(false);
      return;
    }

    if (!rGestion.ok && rGestion.status === 401) {
      redirectToLoginIfUnauthorized(rGestion.status);
      setError(rGestion.message);
      setLoading(false);
      return;
    }

    setData({
      stats: rStats.data,
      clientes: rCli.data,
      empresas: rEmp.data,
      representantes: rRep.data,
      prestamos: rPre.data,
      gestionPendientes: rGestion.ok ? rGestion.data : null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !error && !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="h-28 w-full rounded-xl bg-muted" />
        <CardGridSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>No se pudo cargar el panel</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap text-sm">
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/login">Ir al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    stats,
    clientes,
    empresas,
    representantes,
    prestamos: fin,
    gestionPendientes,
  } = data;
  const empresasSinRnc = Math.max(0, empresas.total - empresas.conRnc);
  const abonosRec = stats.abonos_recientes ?? [];

  return (
    <div className="space-y-8 pb-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            Panel general
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Estado de la cartera y señales operativas
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/reportes" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Ver reportes
          </Link>
        </Button>
      </motion.div>

      {/* ── Cartera hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="metric-icon">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Cartera activa
              </p>
              <p className="text-xs text-muted-foreground">
                Capital pendiente total
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <Link href="/prestamos">
              Ver préstamos
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-3xl font-bold tracking-tight tabular md:text-4xl">
              {formatRD(fin.capitalPendiente)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Principal por cobrar (excluye saldados)
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="badge-activo">
                Activos: {fin.prestamosActivos}
              </span>
              <span className="badge-mora">Mora: {fin.prestamosMora}</span>
              <span className="badge-saldado">
                Saldados: {fin.prestamosSaldados}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-7">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total histórico prestado
              </p>
              <p className="mt-1 text-xl font-bold tabular">
                {formatRD(fin.totalPrestado)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Intereses pendientes (hist.)
              </p>
              <p className="mt-1 text-xl font-bold tabular">
                {formatRD(fin.interesPendienteAcumulado)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Períodos en estado PENDIENTE
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Alert KPIs ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Seguimiento y cobranza
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Vencen en 7 días"
            value={fin.alertas.vencenProximos7Dias}
            sub="Próxima cuota en la ventana"
            icon={CalendarClock}
            accent="text-amber-600 dark:text-amber-400"
            index={0}
          />
          <StatCard
            label="En mora"
            value={fin.alertas.enMora}
            sub="Préstamos estado MORA"
            icon={AlertCircle}
            accent="text-destructive"
            index={1}
          />
          <StatCard
            label="Con interés pendiente"
            value={fin.alertas.prestamosConInteresPendiente}
            sub="Períodos abiertos"
            icon={CircleDollarSign}
            index={2}
          />
          <StatCard
            label="Recaudación del mes"
            value={formatRD(stats.recaudacion_mes)}
            sub="Suma de abonos"
            icon={PiggyBank}
            index={3}
          />
          <StatCard
            label="Cobranzas pendientes"
            value={gestionPendientes?.total ?? "—"}
            sub={
              gestionPendientes == null
                ? "Requiere migración"
                : "Próxima fecha vencida"
            }
            icon={PhoneForwarded}
            index={4}
          />
        </div>
      </section>

      {/* ── Cobranza queue ── */}
      {gestionPendientes && gestionPendientes.total > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Cola de seguimiento
          </h2>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {gestionPendientes.total} caso
                {gestionPendientes.total !== 1 ? "s" : ""} pendiente
                {gestionPendientes.total !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Abre el detalle para registrar gestión
              </p>
            </div>
            <ul className="divide-y divide-border">
              {gestionPendientes.items.map((row) => {
                const nombre = row.clientes
                  ? `${row.clientes.nombre} ${row.clientes.apellido}`.trim()
                  : `Cliente #${row.cliente_id}`;
                const href =
                  row.prestamo_id != null
                    ? `/prestamos/${row.prestamo_id}`
                    : `/clientes/${row.cliente_id}`;
                return (
                  <li
                    key={`${row.prestamo_id ?? "c"}-${row.cliente_id}-${row.id}`}
                  >
                    <Link
                      href={href}
                      className="flex flex-col gap-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-foreground">
                        {nombre}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {labelResultadoGestion(row.resultado)}
                        </Badge>
                        <span className="tabular">
                          Próx. {row.proxima_fecha_contacto}
                        </span>
                        {row.prestamo_id != null ? (
                          <span>Prést. #{row.prestamo_id}</span>
                        ) : (
                          <span>Solo cliente</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.section>
      )}

      {/* ── Red comercial ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Red comercial
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Clientes",
              total: clientes.total,
              totalLabel: "Total registrados",
              rows: [
                { label: "Validados", value: clientes.validados },
                {
                  label: "Pendientes de validar",
                  value: clientes.pendientesValidacion,
                  accent:
                    clientes.pendientesValidacion > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : undefined,
                },
              ],
              href: "/clientes",
              cta: "Ver clientes",
            },
            {
              icon: Landmark,
              title: "Empresas",
              total: empresas.total,
              totalLabel: "Total registradas",
              rows: [
                { label: "Con RNC", value: empresas.conRnc },
                { label: "Sin RNC", value: empresasSinRnc },
              ],
              href: "/empresas",
              cta: "Ver empresas",
            },
            {
              icon: UserSquare2,
              title: "Representantes",
              total: representantes.totalRepresentantes,
              totalLabel: "En catálogo",
              rows: [
                {
                  label: "Clientes vinculados",
                  value: representantes.totalClientesVinculados,
                },
                { label: "Con cartera activa", value: stats.clientes_activos },
              ],
              href: "/representantes",
              cta: "Ver representantes",
            },
          ].map(
            ({ icon: Icon, title, total, totalLabel, rows, href, cta }, i) => (
              <motion.div
                key={title}
                custom={i}
                variants={fade}
                initial="hidden"
                animate="show"
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="metric-icon">
                    <Icon className="size-4" />
                  </div>
                  <p className="font-medium text-foreground">{title}</p>
                </div>
                <p className="text-2xl font-bold tabular">{total}</p>
                <p className="text-xs text-muted-foreground">{totalLabel}</p>
                <Separator className="my-3" />
                <div className="space-y-1.5">
                  {rows.map(({ label, value, accent }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-medium", accent)}>{value}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  asChild
                >
                  <Link href={href}>{cta}</Link>
                </Button>
              </motion.div>
            ),
          )}
        </div>
      </section>

      {/* ── Capitalización ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Capitalización
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Auto (acumulado)",
              value: formatRD(fin.capitalizacionAuto),
              icon: Zap,
              accent: "text-primary dark:text-[#3385FF]",
            },
            {
              label: "Manual (acumulado)",
              value: formatRD(fin.capitalizacionManual),
              icon: ClipboardList,
              accent: "text-[#0044AA] dark:text-[#00D2FF]",
            },
            {
              label: "Auto últimos 7 días",
              value: fin.alertas.capitalizacionesAutoUltimos7Dias,
              icon: Sparkles,
              sub: "Operaciones en reganches",
            },
            {
              label: "Clientes con préstamo activo",
              value: stats.clientes_activos,
              icon: UserCheck,
              sub: "Personas con al menos 1 activo",
            },
          ].map(({ label, value, icon: Icon, accent, sub }, i) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              sub={sub}
              icon={Icon}
              accent={accent}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* ── Quick links ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Accesos rápidos
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((q, i) => (
            <motion.div
              key={q.href}
              custom={i}
              variants={fade}
              initial="hidden"
              animate="show"
            >
              <Link
                href={q.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border p-3.5 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
                  q.bg,
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80 border border-border/50",
                    q.color,
                  )}
                >
                  <q.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground leading-tight group-hover:text-primary transition-colors">
                    {q.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.desc}
                  </p>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Activity feeds ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Próximos vencimientos */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Próximos vencimientos
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ACTIVO o MORA ordenados por fecha de cuota
            </p>
          </div>
          {stats.proximos_vencimientos.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay préstamos en seguimiento
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {stats.proximos_vencimientos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/prestamos/${p.id}`}
                    className="flex flex-col gap-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">
                      {p.clientes
                        ? `${p.clientes.nombre} ${p.clientes.apellido}`
                        : "Cliente"}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · #{p.id}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular">
                      <span>{p.fecha_proximo_vencimiento}</span>
                      <span>·</span>
                      <span>{formatRD(p.capital_pendiente)}</span>
                      <span
                        className={
                          p.estado === "MORA" ? "badge-mora" : "badge-saldado"
                        }
                      >
                        {p.estado}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <PiggyBank className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Actividad reciente
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Últimos abonos registrados
            </p>
          </div>
          {abonosRec.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aún no hay abonos registrados
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {abonosRec.map((a) => {
                const cli = a.prestamos?.clientes;
                const nombre = cli
                  ? `${cli.nombre} ${cli.apellido}`.trim()
                  : "—";
                return (
                  <li key={a.id}>
                    <Link
                      href={`/prestamos/${a.prestamo_id}`}
                      className="flex flex-col gap-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium">{nombre}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {a.fecha_abono} · {formatRD(a.total_pagado)}
                        <span className="ml-1.5">Prést. #{a.prestamo_id}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
