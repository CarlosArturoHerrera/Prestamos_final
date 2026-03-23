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

type Rep = {
  id: number
  nombre: string
  apellido: string
  telefono: string
  email: string
  clientes_asignados?: number
}

export default function RepresentantesPage() {
  const [rows, setRows] = useState<Rep[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, pageSize: "100" })
    const res = await fetchApi<{ data: Rep[] }>(`/api/representantes?${q}`)
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
      await load()
    }
    setDeleteId(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Representantes</h1>
          <p className="text-sm text-muted-foreground">Recibe notificaciones de cobranza por WhatsApp y correo.</p>
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
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar..."
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
              <TableHead>Nombre completo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Sin datos</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.nombre} {r.apellido}
                  </TableCell>
                  <TableCell>{r.telefono}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.clientes_asignados ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
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
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}>
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
  )
}
