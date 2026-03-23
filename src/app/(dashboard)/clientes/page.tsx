"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Info, Pencil, Plus, Trash2 } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { useDebouncedValue } from "@/lib/use-debounced-value"

type ClienteRow = {
  id: number
  nombre: string
  apellido: string
  cedula: string
  ultimo_pago: string | null
  estado_validacion?: "VALIDADO" | "PENDIENTE_VALIDAR"
  empresas: { nombre: string } | null
  representantes: { nombre: string; apellido: string } | null
}

export default function ClientesPage() {
  const [rows, setRows] = useState<ClienteRow[]>([])
  const [search, setSearch] = useState("")
  const searchDebounced = useDebouncedValue(search, 350)
  const [filtroEmpresa, setFiltroEmpresa] = useState("")
  const [filtroRep, setFiltroRep] = useState("")
  const [filtroEstadoValidacion, setFiltroEstadoValidacion] = useState("")
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search: searchDebounced, pageSize: "50" })
    if (filtroEmpresa) q.set("empresaId", filtroEmpresa)
    if (filtroRep) q.set("representanteId", filtroRep)
    if (filtroEstadoValidacion) q.set("estadoValidacion", filtroEstadoValidacion)
    const res = await fetchApi<{ data: ClienteRow[] }>(`/api/clientes?${q}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
    } else {
      setRows(res.data.data ?? [])
    }
    setLoading(false)
  }, [searchDebounced, filtroEmpresa, filtroRep, filtroEstadoValidacion])

  useEffect(() => {
    load()
  }, [load])

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
    void (async () => {
      await loadEmpresasYReps()
    })()
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
      await load()
    }
    setDeleteId(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Deudores vinculados a empresa y representante.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v)
          if (!v) setEditing(null)
        }}>
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
                      <Link href="/empresas" className="font-medium text-primary underline underline-offset-2">
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
                    <SelectValue placeholder={empresas.length ? "Seleccionar" : "Sin empresas — créalas primero"} />
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
                      empresas.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.nombre}
                        </SelectItem>
                      ))
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
                      reps.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.nombre} {r.apellido}
                        </SelectItem>
                      ))
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
                  !form.empresaId || !form.representanteId
                    ? "Elige empresa y representante"
                    : undefined
                }
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Nombre, cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filtroEmpresa || "all"} onValueChange={(v) => setFiltroEmpresa(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Empresa" />
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
        <Select value={filtroRep || "all"} onValueChange={(v) => setFiltroRep(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Representante" />
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
        <Select
          value={filtroEstadoValidacion || "all"}
          onValueChange={(v) => setFiltroEstadoValidacion(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Estado validación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="VALIDADO">Validado</SelectItem>
            <SelectItem value="PENDIENTE_VALIDAR">Pendiente de validar</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>
          Buscar
        </Button>
      </div>

      <div className="rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Validación</TableHead>
              <TableHead>Último pago</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>Sin clientes</TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clientes/${c.id}`} className="text-primary hover:underline">
                      {c.nombre} {c.apellido}
                    </Link>
                  </TableCell>
                  <TableCell>{c.cedula}</TableCell>
                  <TableCell>{c.empresas?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    {c.representantes
                      ? `${c.representantes.nombre} ${c.representantes.apellido}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {c.estado_validacion === "PENDIENTE_VALIDAR" ? "Pendiente de validar" : "Validado"}
                  </TableCell>
                  <TableCell>{c.ultimo_pago ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
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
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
  )
}
