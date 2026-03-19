"use client"

import { useState, type ReactNode, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Client } from "@/lib/types/client"

interface Segment {
  id: number
  name: string
}

interface ClientCreateDialogProps {
  trigger: ReactNode
  onCreate: (client: Client) => void
}

export function ClientCreateDialog({ trigger, onCreate }: ClientCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [form, setForm] = useState({
    name: "",
    segment: "",
    phone: "",
    email: "",
    location: "",
    notes: "",
  })

  useEffect(() => {
    if (open) {
      const loadSegments = async () => {
        try {
          const response = await fetch("/api/segments")
          if (response.ok) {
            const data = await response.json()
            setSegments(data)
          }
        } catch (error) {
          console.error("Error loading segments:", error)
        }
      }
      loadSegments()
    }
  }, [open])

  const resetForm = () =>
    setForm({
      name: "",
      segment: "",
      phone: "",
      email: "",
      location: "",
      notes: "",
    })

  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          segment: form.segment.trim(),
          email: form.email.trim() || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al crear cliente")
      }

      const newClient = await response.json() as Client
      onCreate(newClient)
      toast.success("Cliente creado exitosamente")
      setOpen(false)
      resetForm()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Error al crear cliente"
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre completo"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="segment">Perfil <span className="text-destructive">*</span></Label>
            <Select value={form.segment} onValueChange={(value) => setForm({ ...form, segment: value })}>
              <SelectTrigger id="segment">
                <SelectValue placeholder="Selecciona un perfil" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((seg) => (
                  <SelectItem key={seg.id} value={seg.name}>
                    {seg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ciudad, provincia"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono <span className="text-destructive">*</span></Label>
              <Input
                id="phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 809 ..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Estado</Label>
            <Input id="status" value="En seguimiento" disabled className="bg-accent/65" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="risk">Riesgo</Label>
              <Input id="risk" value="Estable" disabled className="bg-accent/65" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Motivo del préstamo, ingresos, referencias..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.phone.trim()}>
              Guardar
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  )
}
