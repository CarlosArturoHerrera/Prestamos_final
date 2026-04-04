"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  User,
  Zap,
} from "lucide-react"
import { addDays } from "date-fns"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { cn } from "@/lib/utils"

type PrestamoList = {
  id: number
  monto: string | number
  capital_pendiente: string | number
  tasa_interes: string | number
  fecha_proximo_vencimiento: string
  estado: string
  tiene_interes_pendiente?: boolean
  tiene_capitalizacion_auto?: boolean
  tiene_capitalizacion_manual?: boolean
  clientes: {
    id: number
    nombre: string
    apellido: string
    cedula: string
    empresas?: { id: number; nombre: string } | null
    representantes?: { id: number; nombre: string; apellido: string } | null
  } | null
  interes_proximo: string
  capital_debitar_proximo: string
  total_proximo_pago: string
}

type PrestamosListResponse = {
  data: PrestamoList[]
  page: number
  pageSize: number
  total: number
}

type ClientePickRow = {
  id: number
  nombre: string
  apellido: string
  cedula?: string | null
  telefono?: string | null
}

type ResumenFin = {
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

function estBadgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  const u = estado.toUpperCase()
  if (u === "MORA") return "destructive"
  if (u === "SALDADO") return "secondary"
  return "default"
}

/** Fila: borde izquierdo + fondo más marcado para escaneo rápido. */
function rowVisualClasses(p: PrestamoList): string {
  if (p.estado === "SALDADO") {
    return "border-l-[5px] border-muted-foreground/25 bg-muted/20"
  }
  if (p.estado === "MORA") {
    return "border-l-[5px] border-destructive bg-red-500/15 ring-1 ring-inset ring-destructive/25"
  }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const v = new Date(`${p.fecha_proximo_vencimiento}T12:00:00`)
  const en7 = addDays(hoy, 7)
  if (v < hoy) {
    return "border-l-[5px] border-amber-600 bg-amber-500/14"
  }
  if (v <= en7) {
    return "border-l-[5px] border-amber-500 bg-amber-400/12"
  }
  return "border-l-[5px] border-emerald-500/45 bg-emerald-500/[0.07]"
}

function requiereAtencionFecha(p: PrestamoList): boolean {
  if (p.estado === "SALDADO" || p.estado === "MORA") return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const v = new Date(`${p.fecha_proximo_vencimiento}T12:00:00`)
  const en7 = addDays(hoy, 7)
  return v <= en7
}

function atencionVencimientoBadges(p: PrestamoList): ReactNode {
  if (p.estado === "SALDADO" || p.estado === "MORA") return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const v = new Date(`${p.fecha_proximo_vencimiento}T12:00:00`)
  const en7 = addDays(hoy, 7)
  if (v < hoy) {
    return (
      <Badge variant="outline" className="border-amber-700/50 bg-amber-600/15 font-medium">
        Atrasado
      </Badge>
    )
  }
  if (v <= en7) {
    return (
      <Badge variant="outline" className="border-amber-600/50 bg-amber-500/10 font-medium">
        Vence pronto
      </Badge>
    )
  }
  return null
}

const PAGE_SIZE = 50

export default function PrestamosPage() {
  const [rows, setRows] = useState<PrestamoList[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<ResumenFin | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [clientePickerOpen, setClientePickerOpen] = useState(false)
  const [clienteSearch, setClienteSearch] = useState("")
  const [debouncedClienteQ, setDebouncedClienteQ] = useState("")
  const [clienteResults, setClienteResults] = useState<ClientePickRow[]>([])
  const [clientePickerLoading, setClientePickerLoading] = useState(false)
  const [clienteLabel, setClienteLabel] = useState("")

  const [estadoFiltro, setEstadoFiltro] = useState<string>("")
  const [conInteresPendiente, setConInteresPendiente] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [exporting, setExporting] = useState<null | "csv" | "xlsx">(null)

  const [form, setForm] = useState({
    clienteId: "",
    monto: "",
    tasaInteres: "",
    plazo: "12",
    tipoPlazo: "MENSUAL",
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaProximoPago: "",
    notas: "",
  })

  const urlSynced = useRef(false)
  useEffect(() => {
    if (urlSynced.current || typeof window === "undefined") return
    urlSynced.current = true
    const p = new URLSearchParams(window.location.search)
    const est = p.get("estado")
    if (est === "MORA" || est === "ACTIVO" || est === "SALDADO") {
      setEstadoFiltro(est)
    }
    if (p.get("conInteresPendiente") === "true") {
      setConInteresPendiente(true)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const loadResumen = useCallback(async () => {
    setResumenLoading(true)
    const res = await fetchApi<ResumenFin>("/api/prestamos/resumen")
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      setResumen(null)
    } else {
      setResumen(res.data)
    }
    setResumenLoading(false)
  }, [])

  useEffect(() => {
    void loadResumen()
  }, [loadResumen])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("pageSize", String(PAGE_SIZE))
    params.set("page", String(page))
    if (estadoFiltro) {
      params.set("estado", estadoFiltro)
    }
    if (conInteresPendiente) params.set("conInteresPendiente", "true")
    if (debouncedQ) params.set("q", debouncedQ)

    const res = await fetchApi<PrestamosListResponse>(`/api/prestamos?${params.toString()}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
      setTotal(0)
    } else {
      setRows(res.data.data ?? [])
      setTotal(res.data.total ?? 0)
    }
    setLoading(false)
  }, [page, estadoFiltro, conInteresPendiente, debouncedQ])

  useEffect(() => {
    void load()
  }, [load])

  const resetFilters = () => {
    setEstadoFiltro("")
    setConInteresPendiente(false)
    setSearchInput("")
    setPage(1)
  }

  const onEstadoChange = (v: string) => {
    setEstadoFiltro(v === "__all__" ? "" : v)
    setPage(1)
  }

  const onConInteresChange = (checked: boolean) => {
    setConInteresPendiente(checked)
    setPage(1)
  }

  const buildExportQuery = () => {
    const params = new URLSearchParams()
    if (estadoFiltro) params.set("estado", estadoFiltro)
    if (conInteresPendiente) params.set("conInteresPendiente", "true")
    if (debouncedQ) params.set("q", debouncedQ)
    return params.toString()
  }

  const descargarExport = async (format: "csv" | "xlsx") => {
    if (exporting) return
    setExporting(format)
    try {
      const q = buildExportQuery()
      const url = `/api/prestamos/export?format=${format}${q ? `&${q}` : ""}`
      const r = await fetch(url, { credentials: "same-origin" })
      if (r.status === 401) {
        redirectToLoginIfUnauthorized(401)
        toast.error("Sesión expirada")
        return
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(typeof j.error === "string" ? j.error : "No se pudo exportar")
        return
      }
      const blob = await r.blob()
      const dispo = r.headers.get("Content-Disposition")
      const m = dispo?.match(/filename="([^"]+)"/) ?? dispo?.match(/filename=([^;]+)/)
      const name = (m?.[1] ?? `prestamos.${format}`).trim()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(format === "xlsx" ? "Excel descargado" : "CSV descargado")
    } catch {
      toast.error("Error de red al exportar")
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClienteQ(clienteSearch.trim()), 280)
    return () => clearTimeout(t)
  }, [clienteSearch])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setClientePickerLoading(true)
    const params = new URLSearchParams({ pageSize: "100" })
    if (debouncedClienteQ) params.set("search", debouncedClienteQ)
    fetch(`/api/clientes?${params.toString()}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setClienteResults(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => {
        if (!cancelled) setClienteResults([])
      })
      .finally(() => {
        if (!cancelled) setClientePickerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, debouncedClienteQ])

  const crear = async () => {
    if (isCreating) return
    setIsCreating(true)
    const res = await fetchApi("/api/prestamos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: Number(form.clienteId),
        monto: form.monto,
        tasaInteres: form.tasaInteres,
        plazo: Number(form.plazo),
        tipoPlazo: form.tipoPlazo,
        fechaInicio: form.fechaInicio,
        fechaProximoPago: form.fechaProximoPago || undefined,
        notas: form.notas || null,
      }),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setIsCreating(false)
      return
    }
    toast.success("Préstamo creado")
    setOpen(false)
    await loadResumen()
    await load()
    setIsCreating(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

  const tableRows = useMemo(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={11}>Cargando…</TableCell>
        </TableRow>
      )
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={11}>Sin préstamos con estos filtros</TableCell>
        </TableRow>
      )
    }
    return rows.map((p) => {
      const saldado = p.estado === "SALDADO"
      const cli = p.clientes
      const rep = cli?.representantes
        ? `${cli.representantes.nombre ?? ""} ${cli.representantes.apellido ?? ""}`.trim()
        : ""
      const atencionFecha = requiereAtencionFecha(p)
      return (
        <TableRow key={p.id} className={cn(rowVisualClasses(p), "transition-colors")}>
          <TableCell className="w-14 align-top">
            <div className="flex flex-col items-center gap-1.5 py-0.5">
              {p.estado === "MORA" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex rounded-md bg-destructive/15 p-1">
                      <AlertTriangle className="size-5 text-destructive" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>En mora</TooltipContent>
                </Tooltip>
              ) : null}
              {p.tiene_interes_pendiente ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex rounded-md bg-amber-500/20 p-1 ring-1 ring-amber-500/40">
                      <CircleDollarSign className="size-4 text-amber-800 dark:text-amber-200" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Interés pendiente (histórico)</TooltipContent>
                </Tooltip>
              ) : null}
              {atencionFecha ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex rounded-md bg-amber-500/15 p-1">
                      <CalendarClock className="size-4 text-amber-700 dark:text-amber-300" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Vencimiento próximo o atrasado (sin mora)</TooltipContent>
                </Tooltip>
              ) : null}
              {p.tiene_capitalizacion_auto ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex rounded-md bg-violet-500/15 p-1">
                      <Zap className="size-4 text-violet-700 dark:text-violet-300" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Hubo capitalización automática (reganche AUTO)</TooltipContent>
                </Tooltip>
              ) : null}
              {p.tiene_capitalizacion_manual ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex rounded-md bg-sky-500/15 p-1">
                      <PenLine className="size-4 text-sky-800 dark:text-sky-200" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Hubo capitalización manual (reganche MANUAL)</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">#{p.id}</TableCell>
          <TableCell>
            <div className="font-medium">
              {cli ? `${cli.nombre} ${cli.apellido}` : "—"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Cédula: {cli?.cedula ?? "—"}
              {cli?.empresas?.nombre ? (
                <>
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">Empresa: {cli.empresas.nombre}</span>
                </>
              ) : null}
              {rep ? (
                <>
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">Rep.: {rep}</span>
                </>
              ) : null}
            </div>
          </TableCell>
          <TableCell>{formatRD(p.monto)}</TableCell>
          <TableCell>{saldado ? "—" : formatRD(p.interes_proximo)}</TableCell>
          <TableCell>{saldado ? "—" : formatRD(p.capital_debitar_proximo)}</TableCell>
          <TableCell>{p.tasa_interes}%</TableCell>
          <TableCell className="whitespace-nowrap">
            <span
              className={cn(
                !saldado && atencionFecha && "rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-950 dark:text-amber-100",
              )}
            >
              {p.fecha_proximo_vencimiento}
            </span>
          </TableCell>
          <TableCell className="font-medium">{saldado ? "—" : formatRD(p.total_proximo_pago)}</TableCell>
          <TableCell>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={estBadgeVariant(p.estado)}
                className={cn(
                  "text-[11px] uppercase tracking-wide shadow-sm",
                  p.estado === "MORA" && "ring-2 ring-destructive/50",
                )}
              >
                {p.estado}
              </Badge>
              {p.tiene_interes_pendiente ? (
                <Badge
                  variant="outline"
                  className="border-amber-600/60 bg-amber-500/20 font-semibold text-amber-950 dark:text-amber-100"
                >
                  Int. pend.
                </Badge>
              ) : null}
              {p.tiene_capitalizacion_auto ? (
                <Badge variant="outline" className="border-violet-500/50 bg-violet-500/15 text-violet-950 dark:text-violet-100">
                  Cap. AUTO
                </Badge>
              ) : null}
              {p.tiene_capitalizacion_manual ? (
                <Badge variant="outline" className="border-sky-500/50 bg-sky-500/15 text-sky-950 dark:text-sky-100">
                  Cap. MANUAL
                </Badge>
              ) : null}
              {!saldado ? atencionVencimientoBadges(p) : null}
            </div>
          </TableCell>
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8" aria-label="Acciones">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/prestamos/${p.id}`}>Ver préstamo</Link>
                </DropdownMenuItem>
                {cli?.id ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/clientes/${cli.id}`} className="flex items-center">
                      <User className="mr-2 size-4 opacity-70" />
                      Ficha cliente
                    </Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      )
    })
  }, [loading, rows])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Préstamos</h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento diario: filtros, búsqueda y métricas del portafolio. Colores de fila: mora · vence
              pronto o atrasado · al día.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setForm({
                    clienteId: "",
                    monto: "",
                    tasaInteres: "",
                    plazo: "12",
                    tipoPlazo: "MENSUAL",
                    fechaInicio: new Date().toISOString().slice(0, 10),
                    fechaProximoPago: "",
                    notas: "",
                  })
                  setClienteSearch("")
                  setDebouncedClienteQ("")
                  setClienteResults([])
                  setClienteLabel("")
                  setClientePickerOpen(false)
                }}
              >
                <Plus className="mr-2 size-4" />
                Nuevo préstamo
              </Button>
            </DialogTrigger>
            {open && (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo préstamo</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Popover
                      modal={false}
                      open={clientePickerOpen}
                      onOpenChange={(next) => {
                        setClientePickerOpen(next)
                        if (next) {
                          setClienteSearch("")
                          setDebouncedClienteQ("")
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientePickerOpen}
                          className="h-10 w-full justify-between font-normal"
                        >
                          <span className={cn("truncate", !clienteLabel && "text-muted-foreground")}>
                            {clienteLabel || "Buscar cliente…"}
                          </span>
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-md p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Nombre, apellido, cédula o teléfono…"
                            value={clienteSearch}
                            onValueChange={setClienteSearch}
                          />
                          <CommandList>
                            {clientePickerLoading ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
                            ) : (
                              <>
                                <CommandEmpty>Sin coincidencias</CommandEmpty>
                                <CommandGroup>
                                  {clienteResults.map((c) => {
                                    const title = `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()
                                    const meta = [c.cedula, c.telefono].filter(Boolean).join(" · ")
                                    const selected = form.clienteId === String(c.id)
                                    return (
                                      <CommandItem
                                        key={c.id}
                                        value={`${c.id}-${title}`}
                                        onSelect={() => {
                                          setForm({ ...form, clienteId: String(c.id) })
                                          setClienteLabel(title)
                                          setClientePickerOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn("mr-2 size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                                          aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium">{title || `Cliente #${c.id}`}</div>
                                          {meta ? (
                                            <div className="truncate text-xs text-muted-foreground">{meta}</div>
                                          ) : null}
                                        </div>
                                      </CommandItem>
                                    )
                                  })}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto (capital inicial)</Label>
                    <Input
                      value={form.monto}
                      onChange={(e) => setForm({ ...form, monto: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tasa % por período</Label>
                    <Input
                      value={form.tasaInteres}
                      onChange={(e) => setForm({ ...form, tasaInteres: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Cuotas</Label>
                      <Input value={form.plazo} onChange={(e) => setForm({ ...form, plazo: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Periodicidad</Label>
                      <Select value={form.tipoPlazo} onValueChange={(v) => setForm({ ...form, tipoPlazo: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DIARIO">Diario</SelectItem>
                          <SelectItem value="SEMANAL">Semanal</SelectItem>
                          <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                          <SelectItem value="MENSUAL">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha inicio</Label>
                    <CalendarDatePicker
                      value={form.fechaInicio}
                      onChange={(value) => setForm({ ...form, fechaInicio: value })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Próxima fecha de pago (manual, opcional)</Label>
                    <CalendarDatePicker
                      value={form.fechaProximoPago}
                      onChange={(value) => setForm({ ...form, fechaProximoPago: value })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button onClick={crear} disabled={isCreating} className="w-full sm:w-auto">
                    {isCreating ? "Creando..." : "Crear"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </div>

        <section aria-label="Resumen financiero del portafolio">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Panel financiero
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {[
              {
                title: "Total prestado",
                desc: "Suma de montos originales",
                value: resumen ? formatRD(resumen.totalPrestado) : "—",
              },
              {
                title: "Capital pendiente",
                desc: "Excluye saldados",
                value: resumen ? formatRD(resumen.capitalPendiente) : "—",
              },
              {
                title: "Interés pendiente (hist.)",
                desc: "Suma períodos PENDIENTE",
                value: resumen ? formatRD(resumen.interesPendienteAcumulado) : "—",
              },
              {
                title: "En mora",
                desc: "Cantidad de préstamos",
                value: resumen ? String(resumen.prestamosMora) : "—",
              },
              {
                title: "Saldados",
                desc: "Cantidad de préstamos",
                value: resumen ? String(resumen.prestamosSaldados) : "—",
              },
              {
                title: "Capitalización AUTO",
                desc: "Reganches con notas AUTO:",
                value: resumen ? formatRD(resumen.capitalizacionAuto) : "—",
              },
              {
                title: "Capitalización MANUAL",
                desc: "Reganches con notas MANUAL:",
                value: resumen ? formatRD(resumen.capitalizacionManual) : "—",
              },
            ].map((k) => (
              <Card key={k.title} className="border-border/60 shadow-sm">
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {k.title}
                  </CardTitle>
                  <CardDescription className="text-[10px] leading-tight">{k.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <p className="text-lg font-semibold tabular-nums sm:text-xl">
                    {resumenLoading ? "…" : k.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {resumen ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Préstamos activos (estado ACTIVO):{" "}
              <span className="font-medium text-foreground">{resumen.prestamosActivos}</span>
            </p>
          ) : null}
        </section>

        <section aria-label="Alertas operativas">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Alertas operativas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Vencen en 7 días",
                desc: "No saldados, próximo venc. entre hoy y +7 días",
                value: resumen?.alertas?.vencenProximos7Dias,
                icon: CalendarClock,
                className: "border-amber-500/25 bg-amber-500/5",
              },
              {
                title: "En mora",
                desc: "Estado MORA",
                value: resumen?.alertas?.enMora,
                icon: AlertTriangle,
                className: "border-destructive/25 bg-destructive/5",
              },
              {
                title: "Con interés pendiente",
                desc: "Préstamos con períodos PENDIENTE",
                value: resumen?.alertas?.prestamosConInteresPendiente,
                icon: CircleDollarSign,
                className: "border-amber-600/20 bg-amber-500/5",
              },
              {
                title: "Cap. AUTO recientes",
                desc: "Reganches AUTO en los últimos 7 días",
                value: resumen?.alertas?.capitalizacionesAutoUltimos7Dias,
                icon: Zap,
                className: "border-violet-500/25 bg-violet-500/5",
              },
            ].map((a) => {
              const Icon = a.icon
              return (
                <Card key={a.title} className={cn("border shadow-sm", a.className)}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">{a.title}</CardTitle>
                      <CardDescription className="text-[11px] leading-snug">{a.desc}</CardDescription>
                    </div>
                    <Icon className="size-5 shrink-0 opacity-70" aria-hidden />
                  </CardHeader>
                  <CardContent className="pb-4 pt-0">
                    <p className="text-3xl font-bold tabular-nums">
                      {resumenLoading ? "…" : String(a.value ?? "—")}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prestamos-buscar">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="prestamos-buscar"
                    className="pl-9"
                    placeholder="Cliente, cédula, empresa o representante"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estadoFiltro || "__all__"} onValueChange={onEstadoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="MORA">Mora</SelectItem>
                    <SelectItem value="SALDADO">Saldado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6 sm:pt-8">
                <Checkbox
                  id="solo-int-pend"
                  checked={conInteresPendiente}
                  onCheckedChange={(c) => onConInteresChange(c === true)}
                />
                <Label htmlFor="solo-int-pend" className="cursor-pointer text-sm font-normal leading-snug">
                  Con interés pendiente (histórico)
                </Label>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!!exporting}
                onClick={() => void descargarExport("csv")}
              >
                <Download className="mr-1.5 size-4" />
                {exporting === "csv" ? "CSV…" : "CSV"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!!exporting}
                onClick={() => void descargarExport("xlsx")}
              >
                <FileSpreadsheet className="mr-1.5 size-4" />
                {exporting === "xlsx" ? "Excel…" : "Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={resetFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Exportación: mismo criterio que los filtros actuales; hasta {8000} filas por archivo (sin sincronizar
            listado en servidor, coherente con proyección de cuota).
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {loading ? (
              "Cargando resultados…"
            ) : total === 0 ? (
              "Sin resultados."
            ) : (
              <>
                Mostrando <span className="font-medium text-foreground">{startIdx}</span>–
                <span className="font-medium text-foreground">{endIdx}</span> de{" "}
                <span className="font-medium text-foreground">{total}</span> préstamo
                {total === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>

        <div className="hidden md:block rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">Señales</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Iconos: mora, interés pendiente, vencimiento, capitalización AUTO/MANUAL en historial.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="w-[4.5rem]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto original</TableHead>
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                        Int. próx. cuota
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Interés del período sobre capital pendiente (próxima cuota estimada). No es el total
                      histórico de intereses atrasados.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="min-w-[9rem]">Capital a debitar</TableHead>
                <TableHead>Tasa %</TableHead>
                <TableHead>Próximo venc.</TableHead>
                <TableHead>Próximo pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[3rem] text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableRows}</TableBody>
          </Table>
        </div>

        <div className="md:hidden block space-y-3">
          {loading ? (
            <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
              Sin préstamos con estos filtros
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((p) => {
                const saldado = p.estado === "SALDADO"
                const cli = p.clientes
                return (
                  <div
                    key={p.id}
                    className={cn("rounded-xl border border-border/60 bg-card/80 p-4", rowVisualClasses(p))}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{p.id}</span>
                          <Badge variant={estBadgeVariant(p.estado)} className="uppercase">
                            {p.estado}
                          </Badge>
                          {p.tiene_interes_pendiente ? (
                            <Badge
                              variant="outline"
                              className="border-amber-600/60 bg-amber-500/20 font-semibold text-amber-950 dark:text-amber-100"
                            >
                              Int. pend.
                            </Badge>
                          ) : null}
                        </div>
                        {!saldado ? atencionVencimientoBadges(p) : null}
                        <p className="text-sm text-muted-foreground">
                          Cliente: {cli ? `${cli.nombre} ${cli.apellido}` : "—"}
                          <span className="ml-1 font-medium text-foreground">{cli?.cedula ? `(${cli.cedula})` : ""}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.tiene_capitalizacion_auto ? (
                          <Badge variant="outline" className="border-violet-500/50 bg-violet-500/15 text-violet-950 dark:text-violet-100">
                            Cap. AUTO
                          </Badge>
                        ) : null}
                        {p.tiene_capitalizacion_manual ? (
                          <Badge variant="outline" className="border-sky-500/50 bg-sky-500/15 text-sky-950 dark:text-sky-100">
                            Cap. MANUAL
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Monto original</p>
                        <p className="font-semibold tabular-nums">{formatRD(p.monto)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Tasa</p>
                        <p className="font-semibold">{p.tasa_interes}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Int. próxima cuota</p>
                        <p className="font-semibold tabular-nums">{saldado ? "—" : formatRD(p.interes_proximo)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Capital a debitar</p>
                        <p className="font-semibold tabular-nums">{saldado ? "—" : formatRD(p.capital_debitar_proximo)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Próximo venc.</p>
                        <p className="font-semibold">{p.fecha_proximo_vencimiento}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Próximo pago</p>
                        <p className="font-semibold tabular-nums">{saldado ? "—" : formatRD(p.total_proximo_pago)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <Button asChild variant="secondary" className="w-full justify-center">
                        <Link href={`/prestamos/${p.id}`}>Ver préstamo</Link>
                      </Button>
                      {cli?.id ? (
                        <Button asChild variant="outline" className="w-full justify-center">
                          <Link href={`/clientes/${cli.id}`}>Ficha cliente</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 size-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
