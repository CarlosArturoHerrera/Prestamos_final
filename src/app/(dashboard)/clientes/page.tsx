"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Pencil, Plus, Trash2 } from "lucide-react"
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

type ClienteRow = {
  id: number
  nombre: string
  apellido: string
  cedula: string
  ultimo_pago: string | null
  empresas: { nombre: string } | null
  representantes: { nombre: string; apellido: string } | null
}

export default function ClientesPage() {
  const [rows, setRows] = useState<ClienteRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClienteRow | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>([])
  const [reps, setReps] = useState<{ id: number; nombre: string; apellido: string }[]>([])
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    cedula: "",
    ubicacion: "",
    telefono: "",
    empresaId: "",
    representanteId: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, pageSize: "100" })
    const r = await fetch(`/api/clientes?${q}`)
    const j = await r.json()
    if (!r.ok) toast.error(j.error ?? "Error")
    else setRows(j.data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => setRole(p.role))
      .catch(() => {})
    fetch("/api/empresas?pageSize=500")
      .then((r) => r.json())
      .then((j) => setEmpresas((j.data ?? []).map((e: { id: number; nombre: string }) => e)))
    fetch("/api/representantes?pageSize=500")
      .then((r) => r.json())
      .then((j) => setReps(j.data ?? []))
  }, [])

  const save = async () => {
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/clientes/${editing.id}` : "/api/clientes"
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        apellido: form.apellido,
        cedula: form.cedula,
        ubicacion: form.ubicacion,
        telefono: form.telefono,
        empresaId: Number(form.empresaId),
        representanteId: Number(form.representanteId),
      }),
    })
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    toast.success("Cliente guardado")
    setOpen(false)
    setEditing(null)
    load()
  }

  const remove = async () => {
    if (!deleteId) return
    const r = await fetch(`/api/clientes/${deleteId}`, { method: "DELETE" })
    const j = await r.json()
    if (!r.ok) toast.error(j.error ?? "Error")
    else {
      toast.success("Eliminado")
      load()
    }
    setDeleteId(null)
  }

  const isAdmin = role === "ADMIN"

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
                <Label>Empresa</Label>
                <Select value={form.empresaId} onValueChange={(v) => setForm({ ...form, empresaId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Select
                  value={form.representanteId}
                  onValueChange={(v) => setForm({ ...form, representanteId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {reps.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.nombre} {r.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Nombre, cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
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
              <TableHead>Último pago</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>Sin clientes</TableCell>
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
                  <TableCell>{c.ultimo_pago ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        const r = await fetch(`/api/clientes/${c.id}`)
                        const j = await r.json()
                        if (!r.ok) {
                          toast.error(j.error ?? "Error")
                          return
                        }
                        setEditing(c)
                        setForm({
                          nombre: j.nombre,
                          apellido: j.apellido,
                          cedula: j.cedula,
                          ubicacion: j.ubicacion,
                          telefono: j.telefono,
                          empresaId: String(j.empresa_id),
                          representanteId: String(j.representante_id),
                        })
                        setOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
