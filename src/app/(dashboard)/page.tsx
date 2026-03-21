"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, CalendarClock, PiggyBank, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { isSupabaseConfiguredOnClient } from "@/lib/env-public"

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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
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

    const res = await fetchApi<Stats>("/api/dashboard/stats")
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      setError(res.message)
      setLoading(false)
      return
    }
    setStats(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
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

  if (!stats) {
    return null
  }

  const kpis = [
    {
      title: "Clientes activos",
      value: String(stats.clientes_activos),
      desc: "Con préstamo en estado ACTIVO",
      icon: Users,
    },
    {
      title: "Préstamos en mora",
      value: String(stats.prestamos_en_mora),
      desc: "Requieren seguimiento",
      icon: AlertCircle,
    },
    {
      title: "Recaudación del mes",
      value: formatRD(stats.recaudacion_mes),
      desc: "Suma de abonos registrados este mes",
      icon: PiggyBank,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen de cartera y próximos vencimientos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{k.title}</CardTitle>
              <k.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
              <p className="text-xs text-muted-foreground">{k.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" />
            Próximos vencimientos
          </CardTitle>
          <CardDescription>Préstamos activos ordenados por fecha de cuota.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.proximos_vencimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.proximos_vencimientos.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <span>
                    {p.clientes ? `${p.clientes.nombre} ${p.clientes.apellido}` : "Cliente"}{" "}
                    <span className="text-muted-foreground">· Préstamo #{p.id}</span>
                  </span>
                  <span className="font-medium text-foreground">
                    {p.fecha_proximo_vencimiento} · {formatRD(p.capital_pendiente)}{" "}
                    <span
                      className={
                        p.estado === "MORA"
                          ? "text-red-600"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      ({p.estado})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
