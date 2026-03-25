"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  PhoneForwarded,
  Landmark,
  PiggyBank,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UserSquare2,
  Zap,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { labelResultadoGestion } from "@/lib/gestion-cobranza"
import { isSupabaseConfiguredOnClient } from "@/lib/env-public"
import { cn } from "@/lib/utils"

type AbonoReciente = {
  id: number
  fecha_abono: string
  total_pagado: string | number
  prestamo_id: number
  prestamos?: {
    id: number
    clientes?: { nombre: string; apellido: string } | null
  } | null
}

type Stats = {
  clientes_activos: number
  prestamos_en_mora: number
  recaudacion_mes: string
  proximos_vencimientos: {
    id: number
    fecha_proximo_vencimiento: string
    capital_pendiente: string | number
    estado: string
    clientes: { nombre: string; apellido: string } | null
  }[]
  abonos_recientes: AbonoReciente[]
}

type ClientesResumen = {
  total: number
  validados: number
  pendientesValidacion: number
}

type EmpresasResumen = {
  total: number
  conRnc: number
}

type RepresentantesResumen = {
  totalRepresentantes: number
  totalClientesVinculados: number
}

type PrestamosResumen = {
  totalPrestado: string
  capitalPendiente: string
  interesPendienteAcumulado: string
  prestamosMora: number
  prestamosSaldados: number
  prestamosActivos: number
  capitalizacionAuto: string
  capitalizacionManual: string
  alertas: {
    vencenProximos7Dias: number
    enMora: number
    prestamosConInteresPendiente: number
    capitalizacionesAutoUltimos7Dias: number
  }
}

type GestionPendienteRow = {
  id: number
  cliente_id: number
  prestamo_id: number | null
  proxima_fecha_contacto: string | null
  created_at: string
  resultado: string
  clientes: { nombre: string; apellido: string } | null
  prestamos: { id: number; estado: string; capital_pendiente: string } | null
}

type GestionPendientesRes = {
  total: number
  items: GestionPendienteRow[]
}

type DashboardData = {
  stats: Stats
  clientes: ClientesResumen
  empresas: EmpresasResumen
  representantes: RepresentantesResumen
  prestamos: PrestamosResumen
  gestionPendientes: GestionPendientesRes | null
}

const quickLinks = [
  {
    href: "/clientes?estadoValidacion=PENDIENTE_VALIDAR",
    label: "Clientes pendientes de validar",
    desc: "Expedientes por revisar",
    icon: UserCheck,
    variant: "amber" as const,
  },
  {
    href: "/prestamos?estado=MORA",
    label: "Préstamos en mora",
    desc: "Seguimiento prioritario",
    icon: AlertCircle,
    variant: "destructive" as const,
  },
  {
    href: "/prestamos?conInteresPendiente=true",
    label: "Con interés pendiente",
    desc: "Histórico de períodos abiertos",
    icon: CircleDollarSign,
    variant: "amber" as const,
  },
  {
    href: "/empresas?sinRnc=true",
    label: "Empresas sin RNC",
    desc: "Completar datos fiscales",
    icon: Building2,
    variant: "muted" as const,
  },
  {
    href: "/representantes?conClientes=true",
    label: "Representantes con cartera",
    desc: "Cartera asignada",
    icon: Users,
    variant: "default" as const,
  },
  {
    href: "/prestamos",
    label: "Cobranza y gestión",
    desc: "Registra seguimientos en el detalle de préstamo o cliente",
    icon: PhoneForwarded,
    variant: "default" as const,
  },
]

function Metric({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!isSupabaseConfiguredOnClient()) {
      setError(
        "Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el despliegue. Configúralas en Vercel y vuelve a publicar.",
      )
      setLoading(false)
      return
    }

    const [rStats, rCli, rEmp, rRep, rPre, rGestion] = await Promise.all([
      fetchApi<Stats>("/api/dashboard/stats"),
      fetchApi<ClientesResumen>("/api/clientes/resumen"),
      fetchApi<EmpresasResumen>("/api/empresas/resumen"),
      fetchApi<RepresentantesResumen>("/api/representantes/resumen"),
      fetchApi<PrestamosResumen>("/api/prestamos/resumen"),
      fetchApi<GestionPendientesRes>("/api/dashboard/gestion-pendientes"),
    ])

    if (!rStats.ok) {
      redirectToLoginIfUnauthorized(rStats.status)
      setError(rStats.message)
      setLoading(false)
      return
    }
    if (!rCli.ok) {
      redirectToLoginIfUnauthorized(rCli.status)
      setError(rCli.message)
      setLoading(false)
      return
    }
    if (!rEmp.ok) {
      redirectToLoginIfUnauthorized(rEmp.status)
      setError(rEmp.message)
      setLoading(false)
      return
    }
    if (!rRep.ok) {
      redirectToLoginIfUnauthorized(rRep.status)
      setError(rRep.message)
      setLoading(false)
      return
    }
    if (!rPre.ok) {
      redirectToLoginIfUnauthorized(rPre.status)
      setError(rPre.message)
      setLoading(false)
      return
    }

    const gestionPendientes = rGestion.ok ? rGestion.data : null
    if (!rGestion.ok && rGestion.status === 401) {
      redirectToLoginIfUnauthorized(rGestion.status)
      setError(rGestion.message)
      setLoading(false)
      return
    }

    setData({
      stats: rStats.data,
      clientes: rCli.data,
      empresas: rEmp.data,
      representantes: rRep.data,
      prestamos: rPre.data,
      gestionPendientes,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !error) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar el panel</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap text-sm">{error}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
          <Button type="button" asChild variant="secondary">
            <Link href="/login">Ir al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { stats, clientes, empresas, representantes, prestamos: fin, gestionPendientes } = data
  const empresasSinRnc = Math.max(0, empresas.total - empresas.conRnc)
  const abonosRec = stats.abonos_recientes ?? []

  return (
    <div className="space-y-10 pb-8">
      <header className="space-y-2 border-b border-border/60 pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            Elicar
          </Badge>
          <span className="text-sm text-muted-foreground">Visión global del sistema</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Panel general</h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Estado de la cartera, red comercial y señales operativas. Los datos se actualizan al cargar la página.
        </p>
      </header>

      {/* Cartera — jerarquía principal */}
      <section aria-labelledby="cartera-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cartera-heading" className="text-lg font-semibold tracking-tight">
              Cartera
            </h2>
            <p className="text-sm text-muted-foreground">Montos y composición de préstamos</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/prestamos">
              Ir a préstamos
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-md">
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-5">
              <Metric
                label="Capital pendiente"
                value={formatRD(fin.capitalPendiente)}
                sub="Principal por cobrar (excluye saldados)"
                className="lg:pr-4"
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-2">
              <Metric label="Total histórico prestado" value={formatRD(fin.totalPrestado)} />
              <Metric
                label="Intereses pendientes (hist.)"
                value={formatRD(fin.interesPendienteAcumulado)}
                sub="Períodos en estado PENDIENTE"
              />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Badge variant="default" className="px-3 py-1 text-xs">
                  Activos: {fin.prestamosActivos}
                </Badge>
                <Badge variant="destructive" className="px-3 py-1 text-xs">
                  Mora: {fin.prestamosMora}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1 text-xs">
                  Saldados: {fin.prestamosSaldados}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seguimiento y flujo */}
      <section aria-labelledby="seguimiento-heading" className="space-y-4">
        <h2 id="seguimiento-heading" className="text-lg font-semibold tracking-tight">
          Seguimiento y cobranza
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="border-amber-500/25 bg-amber-500/[0.04] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-amber-600 dark:text-amber-400" />
                Vencen en 7 días
              </CardTitle>
              <CardDescription>No saldados, próxima cuota en la ventana</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{fin.alertas.vencenProximos7Dias}</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/25 bg-destructive/[0.04] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="size-4 text-destructive" />
                En mora
              </CardTitle>
              <CardDescription>Préstamos estado MORA</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{fin.alertas.enMora}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CircleDollarSign className="size-4 text-primary" />
                Con interés pendiente
              </CardTitle>
              <CardDescription>Préstamos con períodos abiertos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{fin.alertas.prestamosConInteresPendiente}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PiggyBank className="size-4 text-primary" />
                Recaudación del mes
              </CardTitle>
              <CardDescription>Suma de abonos del mes en curso</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{formatRD(stats.recaudacion_mes)}</p>
            </CardContent>
          </Card>
          <Card id="cobranza-pendientes" className="border-teal-500/25 bg-teal-500/[0.04] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PhoneForwarded className="size-4 text-teal-700 dark:text-teal-400" />
                Contactos de cobranza pendientes
              </CardTitle>
              <CardDescription>
                Última gestión con próxima fecha de contacto hoy o vencida (por cliente o préstamo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{gestionPendientes?.total ?? "—"}</p>
              {gestionPendientes == null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Ejecuta la migración de gestión de cobranza en Supabase para activar este indicador.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        {gestionPendientes && gestionPendientes.total > 0 ? (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cola sugerida de seguimiento</CardTitle>
              <CardDescription>Hasta 20 casos; abre el detalle para registrar una nueva gestión</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-2">
                {gestionPendientes.items.map((row) => {
                  const nombre = row.clientes
                    ? `${row.clientes.nombre} ${row.clientes.apellido}`.trim()
                    : `Cliente #${row.cliente_id}`
                  const href = row.prestamo_id != null ? `/prestamos/${row.prestamo_id}` : `/clientes/${row.cliente_id}`
                  return (
                    <li key={`${row.prestamo_id ?? "c"}-${row.cliente_id}-${row.id}`}>
                      <Link
                        href={href}
                        className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5 text-sm transition-colors hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium">{nombre}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {labelResultadoGestion(row.resultado)}
                          </Badge>
                          <span className="tabular-nums">Próx. {row.proxima_fecha_contacto}</span>
                          {row.prestamo_id != null ? (
                            <span>Prést. #{row.prestamo_id}</span>
                          ) : (
                            <span>Solo cliente</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4" />
              Clientes con préstamo activo
            </CardTitle>
            <CardDescription>Personas únicas con al menos un préstamo ACTIVO</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.clientes_activos}</p>
          </CardContent>
        </Card>
      </section>

      {/* Red comercial */}
      <section aria-labelledby="red-heading" className="space-y-4">
        <h2 id="red-heading" className="text-lg font-semibold tracking-tight">
          Red comercial y maestros
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold tabular-nums">{clientes.total}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Validados</span>
                <span className="font-semibold">{clientes.validados}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pendientes</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {clientes.pendientesValidacion}
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/clientes">Gestionar clientes</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="size-4 text-primary" />
                Empresas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">Registradas</span>
                <span className="text-2xl font-bold tabular-nums">{empresas.total}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Con RNC</span>
                <span className="font-semibold">{empresas.conRnc}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sin RNC</span>
                <span className="font-semibold">{empresasSinRnc}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/empresas">Gestionar empresas</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <UserSquare2 className="size-4 text-primary" />
                Representantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">En catálogo</span>
                <span className="text-2xl font-bold tabular-nums">{representantes.totalRepresentantes}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Clientes vinculados (total)</span>
                <span className="font-semibold">{representantes.totalClientesVinculados}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/representantes">Gestionar representantes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Capitalización reciente */}
      <section aria-labelledby="cap-heading" className="space-y-4">
        <h2 id="cap-heading" className="text-lg font-semibold tracking-tight">
          Capitalización e histórico
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-violet-500/20 bg-violet-500/[0.04] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3.5 text-violet-600" />
                AUTO (acumulado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{formatRD(fin.capitalizacionAuto)}</p>
            </CardContent>
          </Card>
          <Card className="border-sky-500/20 bg-sky-500/[0.04] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardList className="size-3.5 text-sky-600" />
                MANUAL (acumulado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{formatRD(fin.capitalizacionManual)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" />
                Capitalizaciones AUTO (últimos 7 días)
              </CardTitle>
              <CardDescription>Operaciones registradas en reganches</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{fin.alertas.capitalizacionesAutoUltimos7Dias}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Accesos rápidos */}
      <section aria-labelledby="accesos-heading" className="space-y-4">
        <h2 id="accesos-heading" className="text-lg font-semibold tracking-tight">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors",
                q.variant === "destructive" && "border-destructive/30 bg-destructive/[0.06] hover:bg-destructive/10",
                q.variant === "amber" && "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/10",
                q.variant === "muted" && "border-border/80 bg-muted/30 hover:bg-muted/50",
                q.variant === "default" && "border-border/60 bg-card hover:bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background/80",
                  q.variant === "destructive" && "border-destructive/30 text-destructive",
                  q.variant === "amber" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
                )}
              >
                <q.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold leading-snug group-hover:underline">{q.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{q.desc}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Próximos vencimientos
            </CardTitle>
            <CardDescription>Préstamos ACTIVO o MORA ordenados por fecha de cuota</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.proximos_vencimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay préstamos en seguimiento.</p>
            ) : (
              <ul className="space-y-2">
                {stats.proximos_vencimientos.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/prestamos/${p.id}`}
                      className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium">
                        {p.clientes ? `${p.clientes.nombre} ${p.clientes.apellido}` : "Cliente"}{" "}
                        <span className="font-normal text-muted-foreground">· #{p.id}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span>{p.fecha_proximo_vencimiento}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{formatRD(p.capital_pendiente)}</span>
                        <Badge variant={p.estado === "MORA" ? "destructive" : "secondary"} className="text-[10px]">
                          {p.estado}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="size-4" />
              Actividad reciente
            </CardTitle>
            <CardDescription>Últimos abonos registrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {abonosRec.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay abonos registrados.</p>
            ) : (
              <ul className="space-y-2">
                {abonosRec.map((a) => {
                  const cli = a.prestamos?.clientes
                  const nombre = cli ? `${cli.nombre} ${cli.apellido}`.trim() : "—"
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/prestamos/${a.prestamo_id}`}
                        className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium">{nombre}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {a.fecha_abono} · {formatRD(a.total_pagado)}
                          <span className="ml-2 text-xs">Prést. #{a.prestamo_id}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
