"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Hash,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
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

type Empresa = {
  id: number
  nombre: string
  rnc: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
}

type ListRes = { data: Empresa[]; page: number; pageSize: number; total: number }

type ResumenEmp = { total: number; conRnc: number }

const PAGE_SIZE = 50

export default function EmpresasPage() {
  const [rows, setRows] = useState<Empresa[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const searchDebounced = useDebouncedValue(search, 350)
  const [conRnc, setConRnc] = useState(false)
  const [sinRncFilter, setSinRncFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<ResumenEmp | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Empresa | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [form, setForm] = useState({
    nombre: "",
    rnc: "",
    direccion: "",
    telefono: "",
    email: "",
  })

  const urlSynced = useRef(false)
  useEffect(() => {
    if (urlSynced.current || typeof window === "undefined") return
    urlSynced.current = true
    const p = new URLSearchParams(window.location.search)
    if (p.get("sinRnc") === "true") {
      setSinRncFilter(true)
      setConRnc(false)
    } else if (p.get("conRnc") === "true") {
      setConRnc(true)
      setSinRncFilter(false)
    }
  }, [])

  const loadResumen = useCallback(async () => {
    setResumenLoading(true)
    const res = await fetchApi<ResumenEmp>("/api/empresas/resumen")
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
    if (sinRncFilter) q.set("sinRnc", "true")
    else if (conRnc) q.set("conRnc", "true")
    const res = await fetchApi<ListRes>(`/api/empresas?${q}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
      setTotal(0)
    } else {
      const body = res.data
      setRows(
        (body.data ?? []).map((x) => ({
          ...x,
          rnc: x.rnc ?? (x as { ruc?: string | null }).ruc ?? null,
        })),
      )
      setTotal(body.total ?? 0)
    }
    setLoading(false)
  }, [searchDebounced, page, conRnc, sinRncFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, conRnc, sinRncFilter])

  const save = async () => {
    if (isSaving) return
    setIsSaving(true)
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/empresas/${editing.id}` : "/api/empresas"
    const res = await fetchApi(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        rnc: form.rnc || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        email: form.email || null,
      }),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setIsSaving(false)
      return
    }
    toast.success("Empresa guardada")
    setOpen(false)
    setEditing(null)
    await loadResumen()
    await load()
    setIsSaving(false)
  }

  const remove = async () => {
    if (!deleteId || isDeleting) return
    setIsDeleting(true)
    const res = await fetchApi(`/api/empresas/${deleteId}`, { method: "DELETE" })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
    } else {
      toast.success("Eliminada")
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
    setConRnc(false)
    setSinRncFilter(false)
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
          <TableCell colSpan={6}>Sin empresas con estos filtros</TableCell>
        </TableRow>
      )
    }
    return rows.map((e) => (
      <TableRow
        key={e.id}
        className={cn(
          e.rnc
            ? "border-l-[5px] border-emerald-500/50 bg-emerald-500/[0.05]"
            : "border-l-[5px] border-muted-foreground/20",
        )}
      >
        <TableCell className="font-mono text-xs text-muted-foreground">#{e.id}</TableCell>
        <TableCell>
          <div className="font-semibold leading-tight">{e.nombre}</div>
          {e.direccion ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.direccion}</p>
          ) : null}
        </TableCell>
        <TableCell>
          {e.rnc ? (
            <Badge variant="secondary" className="font-mono text-[11px]">
              <Hash className="mr-1 size-3 opacity-70" />
              {e.rnc}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Sin RNC</span>
          )}
        </TableCell>
        <TableCell>
          {e.telefono ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5 text-muted-foreground" />
              {e.telefono}
            </span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          {e.email ? (
            <span className="inline-flex items-center gap-1.5 break-all text-sm">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              {e.email}
            </span>
          ) : (
            "—"
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
              <DropdownMenuItem
                onClick={() => {
                  setEditing(e)
                  setForm({
                    nombre: e.nombre,
                    rnc: e.rnc ?? "",
                    direccion: e.direccion ?? "",
                    telefono: e.telefono ?? "",
                    email: e.email ?? "",
                  })
                  setOpen(true)
                }}
              >
                <Pencil className="mr-2 size-4 opacity-70" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(e.id)}>
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
            <h1 className="text-2xl font-bold">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo de empresas vinculadas a clientes. Búsqueda por nombre, RNC o email.
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
                  setForm({ nombre: "", rnc: "", direccion: "", telefono: "", email: "" })
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                Nueva empresa
              </Button>
            </DialogTrigger>
            {open && (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
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
                    <Label>RNC (opcional)</Label>
                    <Input value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input
                      value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
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

        <section aria-label="Resumen de empresas">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Panel
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="size-4 text-primary" />
                  Total empresas
                </CardTitle>
                <CardDescription>Registradas en el sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{resumenLoading ? "…" : (resumen?.total ?? "—")}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Con RNC</CardTitle>
                <CardDescription>Identificación fiscal cargada</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{resumenLoading ? "…" : (resumen?.conRnc ?? "—")}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="emp-search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="emp-search"
                    className="pl-9"
                    placeholder="Nombre, RNC o email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 pb-0.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="emp-con-rnc"
                    checked={conRnc}
                    onCheckedChange={(c) => {
                      const on = c === true
                      setConRnc(on)
                      if (on) setSinRncFilter(false)
                    }}
                  />
                  <Label htmlFor="emp-con-rnc" className="cursor-pointer text-sm font-normal">
                    Solo con RNC
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="emp-sin-rnc"
                    checked={sinRncFilter}
                    onCheckedChange={(c) => {
                      const on = c === true
                      setSinRncFilter(on)
                      if (on) setConRnc(false)
                    }}
                  />
                  <Label htmlFor="emp-sin-rnc" className="cursor-pointer text-sm font-normal">
                    Sin RNC
                  </Label>
                </div>
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
                <TableHead>Empresa</TableHead>
                <TableHead>RNC</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
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
              <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
              <AlertDialogDescription>Solo se permite si no hay clientes asociados.</AlertDialogDescription>
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
