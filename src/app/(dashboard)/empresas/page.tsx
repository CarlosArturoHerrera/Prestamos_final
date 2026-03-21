"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"

type Empresa = {
  id: number
  nombre: string
  ruc: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
}

export default function EmpresasPage() {
  const [rows, setRows] = useState<Empresa[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Empresa | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: "",
    ruc: "",
    direccion: "",
    telefono: "",
    email: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, pageSize: "100" })
    const res = await fetchApi<{ data: Empresa[] }>(`/api/empresas?${q}`)
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      setRows([])
    } else {
      setRows(res.data.data ?? [])
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const res = await fetchApi<{ role: string }>("/api/profile")
      if (res.ok) setRole(res.data.role)
    })()
  }, [])

  const save = async () => {
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/empresas/${editing.id}` : "/api/empresas"
    const res = await fetchApi(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        ruc: form.ruc || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        email: form.email || null,
      }),
    })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    toast.success("Empresa guardada")
    setOpen(false)
    setEditing(null)
    load()
  }

  const remove = async () => {
    if (!deleteId) return
    const res = await fetchApi(`/api/empresas/${deleteId}`, { method: "DELETE" })
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
    } else {
      toast.success("Eliminada")
      load()
    }
    setDeleteId(null)
  }

  const isAdmin = role === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">Catálogo de empresas asociadas a clientes.</p>
        </div>
        {isAdmin && (
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
                  setForm({ nombre: "", ruc: "", direccion: "", telefono: "", email: "" })
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                Nueva empresa
              </Button>
            </DialogTrigger>
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
                  <Label>RUC</Label>
                  <Input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
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
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={save}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por nombre..."
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
              <TableHead>RUC</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Sin empresas</TableCell>
              </TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nombre}</TableCell>
                  <TableCell>{e.ruc ?? "—"}</TableCell>
                  <TableCell>{e.telefono ?? "—"}</TableCell>
                  <TableCell>{e.email ?? "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(e)
                          setForm({
                            nombre: e.nombre,
                            ruc: e.ruc ?? "",
                            direccion: e.direccion ?? "",
                            telefono: e.telefono ?? "",
                            email: e.email ?? "",
                          })
                          setOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(e.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se permite si no hay clientes asociados.
            </AlertDialogDescription>
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
