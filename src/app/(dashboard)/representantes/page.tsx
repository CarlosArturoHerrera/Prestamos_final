"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCircle2,
  Users,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { cn } from "@/lib/utils"

type Rep = {
  id: number
  nombre: string
  apellido: string
  telefono: string
  email: string
  clientes_asignados?: number
}

type ListRes = { data: Rep[]; page: number; pageSize: number; total: number }

type ResumenRep = { totalRepresentantes: number; totalClientesVinculados: number }

const PAGE_SIZE = 50

export default function RepresentantesPage() {
  const [rows, setRows] = useState<Rep[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const searchDebounced = useDebouncedValue(search, 350)
  const [conClientes, setConClientes] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<ResumenRep | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Rep | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
  })

  const urlSynced = useRef(false)
  useEffect(() => {
    if (urlSynced.current || typeof window === "undefined") return
    urlSynced.current = true
    const p = new URLSearchParams(window.location.search)
    if (p.get("conClientes") === "true") {
      setConClientes(true)
    }
  }, [])

  const loadResumen = useCallback(async () => {
    setResumenLoading(true)
    const res = await fetchApi<ResumenRep>("/api/representantes/resumen")
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
    if (conClientes) q.set("conClientes", "true")
    const res = await fetchApi<ListRes>(`/api/representantes?${q}`)
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
  }, [searchDebounced, page, conClientes])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, conClientes])

  const save = async () => {
    if (isSaving) return
    setIsSaving(true)
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/representantes/${editing.id}` : "/api/representantes"
    const res = await fetchApi(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setIsSaving(false)
      return
    }
    toast.success("Guardado")
    setOpen(false)
    setEditing(null)
    await loadResumen()
    await load()
    setIsSaving(false)
  }

  const remove = async () => {
    if (!deleteId || isDeleting) return
    setIsDeleting(true)
    const res = await fetchApi(`/api/representantes/${deleteId}`, { method: "DELETE" })
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

  const resetFilters = () => {
    setSearch("")
    setConClientes(false)
    setPage(1)
  }

  const tableRows = useMemo(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={6}>Cargando…</TableCell>
        </TableRow>
      )
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6}>Sin representantes con estos filtros</TableCell>
        </TableRow>
      )
    }
    return rows.map((r) => {
      const n = r.clientes_asignados ?? 0
      return (
        <TableRow
          key={r.id}
          className={cn(
            n > 0
              ? "border-l-[5px] border-primary/40 bg-primary/[0.04]"
              : "border-l-[5px] border-muted-foreground/20",
          )}
        >
          <TableCell className="font-mono text-xs text-muted-foreground">#{r.id}</TableCell>
          <TableCell>
            <div className="font-semibold leading-tight">
              {r.nombre} {r.apellido}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Notificaciones cobranza (WhatsApp / email)</p>
          </TableCell>
          <TableCell>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5 text-muted-foreground" />
              {r.telefono}
            </span>
          </TableCell>
          <TableCell>
            <span className="inline-flex items-center gap-1.5 break-all text-sm">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              {r.email}
            </span>
          </TableCell>
          <TableCell>
            <Badge
              variant={n > 0 ? "default" : "secondary"}
              className={cn("tabular-nums", n === 0 && "opacity-80")}
            >
              <Users className="mr-1 size-3" />
              {n} cliente{n === 1 ? "" : "s"}
            </Badge>
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
                  <Link href={`/prestamos`} className="flex items-center">
                    Ver cartera en préstamos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(r)
                    setForm({
                      nombre: r.nombre,
                      apellido: r.apellido,
                      telefono: r.telefono,
                      email: r.email,
                    })
                    setOpen(true)
                  }}
                >
                  <Pencil className="mr-2 size-4 opacity-70" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}>
                  <Trash2 className="mr-2 size-4" />
                  Eliminar
                </DropdownMenuItem>
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
            <h1 className="text-2xl font-bold">Representantes</h1>
            <p className="text-sm text-muted-foreground">
              Contactos para cobranza. Búsqueda por nombre, apellido, email o teléfono.
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
                  setForm({ nombre: "", apellido: "", telefono: "", email: "" })
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                Nuevo representante
              </Button>
            </DialogTrigger>
            {open && (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar" : "Nuevo"} representante</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
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
                  <div className="space-y-2">
                    <Label>Teléfono / WhatsApp</Label>
                    <Input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button onClick={save} disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </div>

        <section aria-label="Resumen de representantes">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Panel
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <UserCircle2 className="size-4 text-primary" />
                  Representantes
                </CardTitle>
                <CardDescription>Personas activas en el catálogo</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {resumenLoading ? "…" : (resumen?.totalRepresentantes ?? "—")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-primary" />
                  Clientes vinculados
                </CardTitle>
                <CardDescription>Total de registros de cliente (asignados a algún representante)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {resumenLoading ? "…" : (resumen?.totalClientesVinculados ?? "—")}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="rep-search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="rep-search"
                    className="pl-9"
                    placeholder="Nombre, apellido, email o teléfono"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Checkbox
                  id="rep-con-cli"
                  checked={conClientes}
                  onCheckedChange={(c) => setConClientes(c === true)}
                />
                <Label htmlFor="rep-con-cli" className="cursor-pointer text-sm font-normal">
                  Solo con clientes en cartera
                </Label>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Limpiar filtros
            </Button>
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
                <span className="font-medium text-foreground">{total}</span>
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[4rem]">ID</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cartera</TableHead>
                <TableHead className="w-[3rem] text-right">Acciones</TableHead>
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
              <AlertDialogTitle>¿Eliminar representante?</AlertDialogTitle>
              <AlertDialogDescription>Solo si no tiene clientes asignados.</AlertDialogDescription>
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
