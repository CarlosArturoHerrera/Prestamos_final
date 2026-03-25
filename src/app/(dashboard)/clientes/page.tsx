"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Info,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { cn } from "@/lib/utils"

type ClienteRow = {
  id: number
  nombre: string
  apellido: string
  cedula: string
  telefono: string
  ultimo_pago: string | null
  estado_validacion?: "VALIDADO" | "PENDIENTE_VALIDAR"
  empresas: { nombre: string } | null
  representantes: { nombre: string; apellido: string } | null
}

type ListRes = { data: ClienteRow[]; page: number; pageSize: number; total: number }

type ResumenCli = {
  total: number
  validados: number
  pendientesValidacion: number
}

const PAGE_SIZE = 50

function validacionBadge(estado: string | undefined) {
  if (estado === "PENDIENTE_VALIDAR") {
    return (
      <Badge variant="outline" className="border-amber-600/60 bg-amber-500/20 font-semibold text-amber-950 dark:text-amber-100">
        <AlertCircle className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="font-medium">
      <ShieldCheck className="mr-1 size-3 opacity-80" />
      Validado
    </Badge>
  )
}

export default function ClientesPage() {
  const [rows, setRows] = useState<ClienteRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const searchDebounced = useDebouncedValue(search, 350)
  const [filtroEmpresa, setFiltroEmpresa] = useState("")
  const [filtroRep, setFiltroRep] = useState("")
  const [filtroEstadoValidacion, setFiltroEstadoValidacion] = useState("")
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<ResumenCli | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClienteRow | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>([])
  const [reps, setReps] = useState<{ id: number; nombre: string; apellido: string }[]>([])
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    cedula: "",
    ubicacion: "",
    telefono: "",
    estadoValidacion: "VALIDADO" as "VALIDADO" | "PENDIENTE_VALIDAR",
    empresaId: "",
    representanteId: "",
  })

  const urlSynced = useRef(false)
  useEffect(() => {
    if (urlSynced.current || typeof window === "undefined") return
    urlSynced.current = true
    const p = new URLSearchParams(window.location.search)
    const ev = p.get("estadoValidacion")
    if (ev === "PENDIENTE_VALIDAR" || ev === "VALIDADO") {
      setFiltroEstadoValidacion(ev)
    }
  }, [])

  const loadResumen = useCallback(async () => {
    setResumenLoading(true)
    const res = await fetchApi<ResumenCli>("/api/clientes/resumen")
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
    const q = new URLSearchParams({
      search: searchDebounced,
      pageSize: String(PAGE_SIZE),
      page: String(page),
    })
    if (filtroEmpresa) q.set("empresaId", filtroEmpresa)
    if (filtroRep) q.set("representanteId", filtroRep)
    if (filtroEstadoValidacion) q.set("estadoValidacion", filtroEstadoValidacion)
    const res = await fetchApi<ListRes>(`/api/clientes?${q}`)
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
  }, [searchDebounced, filtroEmpresa, filtroRep, filtroEstadoValidacion, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, filtroEmpresa, filtroRep, filtroEstadoValidacion])

  const loadEmpresasYReps = useCallback(async () => {
    const [e, r] = await Promise.all([
      fetchApi<{ data: { id: number; nombre: string }[] }>("/api/empresas?pageSize=200"),
      fetchApi<{ data: { id: number; nombre: string; apellido: string }[] }>(
        "/api/representantes?pageSize=200",
      ),
    ])
    if (e.ok) setEmpresas((e.data.data ?? []).map((x) => ({ id: x.id, nombre: x.nombre })))
    if (r.ok) setReps(r.data.data ?? [])
  }, [])

  useEffect(() => {
    void loadEmpresasYReps()
  }, [loadEmpresasYReps])

  useEffect(() => {
    if (open) void loadEmpresasYReps()
  }, [open, loadEmpresasYReps])

  const save = async () => {
    if (isSaving) return
    if (!form.empresaId || !form.representanteId) {
      toast.error("Debes elegir una empresa y un representante antes de guardar.")
      return
    }
    setIsSaving(true)
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/clientes/${editing.id}` : "/api/clientes"
    const res = await fetchApi(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        apellido: form.apellido,
        cedula: form.cedula,
        ubicacion: form.ubicacion,
        telefono: form.telefono,
        estadoValidacion: form.estadoValidacion,
        empresaId: Number(form.empresaId),
        representanteId: Number(form.representanteId),
      }),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setIsSaving(false)
      return
    }
    toast.success("Cliente guardado")
    setOpen(false)
    setEditing(null)
    await loadResumen()
    await load()
    setIsSaving(false)
  }

  const remove = async () => {
    if (!deleteId || isDeleting) return
    setIsDeleting(true)
    const res = await fetchApi(`/api/clientes/${deleteId}`, { method: "DELETE" })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
    } else {
      toast.success("Eliminado")
      await loadResumen()
      await load()
    }
    setDeleteId(null)
    setIsDeleting(false)
  }

  const openEdit = async (c: ClienteRow) => {
    const res = await fetchApi<Record<string, unknown>>(`/api/clientes/${c.id}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    const j = res.data
    setEditing(c)
    setForm({
      nombre: String(j.nombre),
      apellido: String(j.apellido),
      cedula: String(j.cedula),
      ubicacion: String(j.ubicacion),
      telefono: String(j.telefono),
      estadoValidacion: (j.estado_validacion as "VALIDADO" | "PENDIENTE_VALIDAR") ?? "VALIDADO",
      empresaId: String(j.empresa_id),
      representanteId: String(j.representante_id),
    })
    setOpen(true)
  }

  const empresaOptions = useMemo(
    () =>
      empresas.map((e) => (
        <SelectItem key={e.id} value={String(e.id)}>
          {e.nombre}
        </SelectItem>
      )),
    [empresas],
  )

  const representanteOptions = useMemo(
    () =>
      reps.map((r) => (
        <SelectItem key={r.id} value={String(r.id)}>
          {r.nombre} {r.apellido}
        </SelectItem>
      )),
    [reps],
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

  const resetFilters = () => {
    setSearch("")
    setFiltroEmpresa("")
    setFiltroRep("")
    setFiltroEstadoValidacion("")
    setPage(1)
  }

  const rowClass = (c: ClienteRow) =>
    c.estado_validacion === "PENDIENTE_VALIDAR"
      ? "border-l-[5px] border-amber-500 bg-amber-500/10"
      : "border-l-[5px] border-emerald-500/35 bg-emerald-500/[0.04]"

  const tableRows = useMemo(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={9}>Cargando…</TableCell>
        </TableRow>
      )
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={9}>Sin clientes con estos filtros</TableCell>
        </TableRow>
      )
    }
    return rows.map((c) => (
      <TableRow key={c.id} className={cn(rowClass(c), "transition-colors")}>
        <TableCell className="font-mono text-xs text-muted-foreground">#{c.id}</TableCell>
        <TableCell>
          <Link
            href={`/clientes/${c.id}`}
            className="font-semibold text-primary hover:underline"
          >
            {c.nombre} {c.apellido}
          </Link>
        </TableCell>
        <TableCell className="font-mono text-sm">{c.cedula}</TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Phone className="size-3.5 text-muted-foreground" />
            {c.telefono}
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            {c.empresas?.nombre ?? "—"}
          </span>
        </TableCell>
        <TableCell className="text-sm">
          {c.representantes ? `${c.representantes.nombre} ${c.representantes.apellido}` : "—"}
        </TableCell>
        <TableCell>{validacionBadge(c.estado_validacion)}</TableCell>
        <TableCell>
          {c.ultimo_pago ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              {c.ultimo_pago}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
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
                <Link href={`/clientes/${c.id}`} className="flex items-center">
                  <User className="mr-2 size-4 opacity-70" />
                  Ver ficha
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openEdit(c)}>
                <Pencil className="mr-2 size-4 opacity-70" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}>
                <Trash2 className="mr-2 size-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ))
  }, [loading, rows])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Deudores vinculados a empresa y representante. Búsqueda por nombre, apellido o cédula.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditing(null)
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null)
                  setForm({
                    nombre: "",
                    apellido: "",
                    cedula: "",
                    ubicacion: "",
                    telefono: "",
                    estadoValidacion: "VALIDADO",
                    empresaId: "",
                    representanteId: "",
                  })
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            {open && (
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar" : "Nuevo"} cliente</DialogTitle>
                </DialogHeader>
                {(empresas.length === 0 || reps.length === 0) && (
                  <Alert>
                    <Info className="size-4" />
                    <AlertDescription className="space-y-2">
                      {empresas.length === 0 && (
                        <p>
                          No hay <strong>empresas</strong> registradas.{" "}
                          <Link
                            href="/empresas"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Ir a Empresas y crear la primera
                          </Link>
                          .
                        </p>
                      )}
                      {reps.length === 0 && (
                        <p>
                          No hay <strong>representantes</strong>.{" "}
                          <Link
                            href="/representantes"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Ir a Representantes y crear uno
                          </Link>
                          .
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3 py-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido</Label>
                      <Input
                        value={form.apellido}
                        onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cédula / DNI</Label>
                    <Input
                      value={form.cedula}
                      onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input
                      value={form.ubicacion}
                      onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado de validación</Label>
                    <Select
                      value={form.estadoValidacion}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          estadoValidacion: v as "VALIDADO" | "PENDIENTE_VALIDAR",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VALIDADO">Validado</SelectItem>
                        <SelectItem value="PENDIENTE_VALIDAR">Pendiente de validar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Empresa</Label>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
                        <Link href="/empresas">
                          <Plus className="size-3.5" />
                          Nueva empresa
                        </Link>
                      </Button>
                    </div>
                    <Select value={form.empresaId} onValueChange={(v) => setForm({ ...form, empresaId: v })}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={empresas.length ? "Seleccionar" : "Sin empresas — créalas primero"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.length === 0 ? (
                          <div className="flex flex-col gap-2 p-2">
                            <p className="text-sm text-muted-foreground">Aún no hay empresas.</p>
                            <Button variant="secondary" size="sm" className="w-full" asChild>
                              <Link href="/empresas">
                                <Plus className="mr-1 size-3.5" />
                                Crear empresa
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          empresaOptions
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Representante</Label>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
                        <Link href="/representantes">
                          <Plus className="size-3.5" />
                          Nuevo representante
                        </Link>
                      </Button>
                    </div>
                    <Select
                      value={form.representanteId}
                      onValueChange={(v) => setForm({ ...form, representanteId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={reps.length ? "Seleccionar" : "Sin representantes — créalos primero"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {reps.length === 0 ? (
                          <div className="flex flex-col gap-2 p-2">
                            <p className="text-sm text-muted-foreground">Aún no hay representantes.</p>
                            <Button variant="secondary" size="sm" className="w-full" asChild>
                              <Link href="/representantes">
                                <Plus className="mr-1 size-3.5" />
                                Crear representante
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          representanteOptions
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={save}
                    disabled={!form.empresaId || !form.representanteId || isSaving}
                    title={
                      !form.empresaId || !form.representanteId ? "Elige empresa y representante" : undefined
                    }
                  >
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </div>

        <section aria-label="Resumen de clientes">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Panel
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Total clientes</CardTitle>
                <CardDescription>Registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{resumenLoading ? "…" : (resumen?.total ?? "—")}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Validados</CardTitle>
                <CardDescription>Listos para operar</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {resumenLoading ? "…" : (resumen?.validados ?? "—")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Pendientes de validar
                </CardTitle>
                <CardDescription>Requieren revisión</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-amber-950 dark:text-amber-100">
                  {resumenLoading ? "…" : (resumen?.pendientesValidacion ?? "—")}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="cli-search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cli-search"
                  className="pl-9"
                  placeholder="Nombre, apellido o cédula"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={filtroEmpresa || "all"} onValueChange={(v) => setFiltroEmpresa(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Representante</Label>
              <Select value={filtroRep || "all"} onValueChange={(v) => setFiltroRep(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los representantes</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.nombre} {r.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label>Validación</Label>
              <Select
                value={filtroEstadoValidacion || "all"}
                onValueChange={(v) => setFiltroEstadoValidacion(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="VALIDADO">Validado</SelectItem>
                  <SelectItem value="PENDIENTE_VALIDAR">Pendiente de validar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end xl:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {loading ? (
              "Cargando…"
            ) : total === 0 ? (
              "Sin resultados."
            ) : (
              <>
                Mostrando <span className="font-medium text-foreground">{startIdx}</span>–
                <span className="font-medium text-foreground">{endIdx}</span> de{" "}
                <span className="font-medium text-foreground">{total}</span> cliente
                {total === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[4rem]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                        Validación
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Estado de validación del expediente del cliente.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Último pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableRows}</TableBody>
          </Table>
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

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
              <AlertDialogDescription>Solo si no tiene préstamos activos o en mora.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove} disabled={isDeleting}>
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
