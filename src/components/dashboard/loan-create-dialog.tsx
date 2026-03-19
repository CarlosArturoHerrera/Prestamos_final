"use client"

import { useState, type ReactNode } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Client } from "@/lib/types/client"

export type LoanFormValues = {
  clientId: string
  amount: string
  rate: string
  termMonths: string
  status: string
  startDate: string
  paymentDays: string[]
}

interface LoanCreateDialogProps {
  trigger: ReactNode
  clients: Pick<Client, "id" | "name">[]
  onCreate: (values: LoanFormValues) => void
}

export function LoanCreateDialog({ trigger, clients, onCreate }: LoanCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [form, setForm] = useState<LoanFormValues>({
    clientId: clients[0]?.id ?? "",
    amount: "",
    rate: "",
    termMonths: "12",
    status: "activo",
    startDate: new Date().toISOString().slice(0, 10),
    paymentDays: ["15", "30"],
  })

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setForm({ ...form, startDate: date.toISOString().slice(0, 10) })
    }
  }

  const handleSubmit = () => {
    // Forzar estado a "en revisión" al crear
    onCreate({ ...form, status: "en revisión" })
    setOpen(false)
  }

  const togglePaymentDay = (day: string) => {
    setForm({
      ...form,
      paymentDays: form.paymentDays.includes(day)
        ? form.paymentDays.filter((d) => d !== day)
        : [...form.paymentDays, day].sort((a, b) => Number(a) - Number(b)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo préstamo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="client">Cliente</Label>
            <Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Ej. 50000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Tasa (%)</Label>
              <Input
                id="rate"
                type="number"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="Ej. 18.5"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="term">Plazo (meses)</Label>
              <Input
                id="term"
                type="number"
                value={form.termMonths}
                onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start">Fecha de inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                  className={cn(
                      "justify-start rounded-xl text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es }) : "Selecciona una fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Estado</Label>
            <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-sm">
              En revisión
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Días de pago</Label>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => (
                <button
                  key={day}
                  onClick={() => togglePaymentDay(day)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    form.paymentDays.includes(day)
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(59,130,246,0.22)]"
                      : "border-input bg-surface hover:border-primary/30 hover:bg-accent/55"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selecciona los días del mes en que el cliente paga
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.clientId || !form.amount.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
