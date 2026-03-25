"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Building2, ChevronRight, MapPin, Phone, UserCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GestionCobranzaPanel } from "@/components/gestion-cobranza-panel"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { cn } from "@/lib/utils"

function estPrestamoBadge(estado: string): "default" | "secondary" | "destructive" | "outline" {
  const u = estado.toUpperCase()
  if (u === "MORA") return "destructive"
  if (u === "SALDADO") return "secondary"
  return "default"
}

function validacionClienteBadge(estado: string | undefined) {
  if (estado === "PENDIENTE_VALIDAR") {
    return (
      <Badge variant="outline" className="border-amber-600/60 bg-amber-500/20 font-semibold">
        Pendiente de validar
      </Badge>
    )
  }
  return <Badge variant="secondary">Validado</Badge>
}

export default function ClienteDetallePage() {
  const params = useParams()
  const id = Number(params.id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchApi<Record<string, unknown>>(`/api/clientes/${id}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setData(null)
    } else {
      setData(res.data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/clientes">← Volver</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>No se encontró el cliente</AlertTitle>
          <AlertDescription>Comprueba el enlace o vuelve al listado.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const prestamos = (data.prestamos as Record<string, unknown>[]) ?? []
  const prestamosGestion = prestamos.map((p) => {
    const pid = Number(p.id)
    const est = String(p.estado ?? "")
    return {
      id: pid,
      label: `#${pid} · ${est} · ${formatRD(p.capital_pendiente as string)}`,
    }
  })
  const emp = data.empresas as { id?: number; nombre?: string } | null | undefined
  const rep = data.representantes as
    | { id?: number; nombre?: string; apellido?: string; telefono?: string; email?: string }
    | null
    | undefined
  const estadoVal = String(data.estado_validacion ?? "")

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/clientes">← Volver al listado</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {String(data.nombre)} {String(data.apellido)}
            </h1>
            {validacionClienteBadge(estadoVal)}
          </div>
          <p className="font-mono text-sm text-muted-foreground">ID cliente #{id}</p>
        </div>
        <Button asChild>
          <Link href={`/prestamos`}>
            Ir a préstamos
            <ChevronRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Contacto y ubicación</CardTitle>
            <CardDescription>Datos principales del deudor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="min-w-[5.5rem] text-muted-foreground">Cédula</span>
              <span className="font-mono font-medium">{String(data.cedula)}</span>
            </div>
            <Separator />
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Teléfono</p>
                <p className="font-medium">{String(data.telefono)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Ubicación</p>
                <p className="font-medium">{String(data.ubicacion)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 min-w-[1rem] text-muted-foreground">Último pago</span>
              <p className="font-medium">{data.ultimo_pago ? String(data.ultimo_pago) : "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Empresa y representante</CardTitle>
            <CardDescription>Vínculos operativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" />
                Empresa
              </div>
              <p className="text-base font-semibold">{emp?.nombre ?? "—"}</p>
              <Button variant="link" className="h-auto px-0 pt-1 text-xs" asChild>
                <Link href="/empresas">Ver catálogo de empresas</Link>
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <UserCircle className="size-4" />
                Representante
              </div>
              <p className="text-base font-semibold">
                {rep ? `${rep.nombre ?? ""} ${rep.apellido ?? ""}`.trim() : "—"}
              </p>
              {rep?.telefono ? (
                <p className="text-xs text-muted-foreground">Tel. {rep.telefono}</p>
              ) : null}
              {rep?.email ? (
                <p className="text-xs text-muted-foreground">{rep.email}</p>
              ) : null}
              <Button variant="link" className="h-auto px-0 pt-1 text-xs" asChild>
                <Link href="/representantes">Ver representantes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <GestionCobranzaPanel clienteId={id} prestamosOpciones={prestamosGestion} />

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Préstamos</CardTitle>
            <CardDescription>Historial asociado a este cliente</CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/prestamos">Abrir módulo préstamos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[4.5rem]">ID</TableHead>
                  <TableHead>Capital pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestamos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Sin préstamos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  prestamos.map((p) => {
                    const est = String(p.estado ?? "")
                    return (
                      <TableRow
                        key={String(p.id)}
                        className={cn(
                          est === "MORA" && "bg-destructive/10",
                          est === "ACTIVO" && "border-l-[3px] border-l-primary/50",
                        )}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{String(p.id)}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatRD(p.capital_pendiente as string)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estPrestamoBadge(est)} className="uppercase">
                            {est}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/prestamos/${p.id}`}>Ver préstamo</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
