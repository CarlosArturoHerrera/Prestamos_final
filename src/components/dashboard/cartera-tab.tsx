"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingUp, DollarSign, AlertCircle, CheckCircle2, Archive, Edit2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoanCreateDialog, type LoanFormValues } from "@/components/dashboard/loan-create-dialog"
import { LoanEditDialog, type LoanEditFormValues } from "@/components/dashboard/loan-edit-dialog"
import { useDebounce } from "@/hooks/use-debounce"

type LoanRow = {
  id: string
  clientId: string
  clientName: string
  amount: number
  rate: number
  termMonths: number
  status: string
  startDate: string | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value)
}

function daysSince(date: string | null) {
  if (!date) return "-"
  const start = new Date(date)
  const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? `${diff}d` : "-"
}

export function CarteraTab() {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 350)

  useEffect(() => {
    let isMounted = true

    const loadClients = async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" })
        if (!res.ok) throw new Error("No se pudieron cargar los clientes")
        const payload = await res.json() as Array<{ id: string; name: string }>
        if (isMounted) {
          setClients(payload.map((client) => ({ id: client.id, name: client.name })))
        }
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : "Error al cargar clientes"
        toast.error(message)
      }
    }

    loadClients()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim())
        }
        const res = await fetch(`/api/loans${params.toString() ? `?${params.toString()}` : ""}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error("No se pudieron cargar los préstamos")
        const raw = await res.json()
        const data: LoanRow[] = (Array.isArray(raw) ? raw : []).map((row: any) => ({
          id: row.id,
          clientId: row.client_id ?? row.clientId,
          clientName: row.client_name ?? row.clientName ?? "",
          amount: Number(row.principal ?? row.amount ?? 0),
          rate: Number(row.interest_rate ?? row.rate ?? 0),
          termMonths: Number(row.term_months ?? row.termMonths ?? 0),
          status: row.status ?? "",
          startDate: row.start_date ?? row.startDate ?? null,
        }))
        if (isMounted) setLoans(data)
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : "Error al cargar préstamos"
        toast.error(message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [debouncedSearch])

  const stats = useMemo(() => {
    const total = loans.reduce((sum, loan) => sum + loan.amount, 0)
    const active = loans.filter((l) => l.status.toLowerCase().includes("activo")).length
    const inReview = loans.filter((l) => !l.status.toLowerCase().includes("activo")).length

    // Tasa promedio anual ponderada por monto (los valores en BD ya son anuales)
    const avgAnnualRate = total > 0
      ? loans.reduce((sum, l) => sum + (l.rate * l.amount), 0) / total
      : 0

    return { total, active, avgRate: avgAnnualRate.toFixed(2), inReview }
  }, [loans])

  const handleCreate = async (values: LoanFormValues) => {
    setIsCreating(true)
    try {
      const res = await fetch("/api/loans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: values.clientId,
          amount: Number(values.amount),
          rate: Number(values.rate),
          termMonths: Number(values.termMonths),
          status: values.status,
          startDate: values.startDate,
        }),
      })
      if (!res.ok) throw new Error("No se pudo crear el préstamo")
      const { id } = await res.json() as { id: string }
      const clientName = clients.find((c) => c.id === values.clientId)?.name ?? ""
      setLoans((prev) => [
        {
          id,
          clientId: values.clientId,
          clientName,
          amount: Number(values.amount),
          rate: Number(values.rate),
          termMonths: Number(values.termMonths),
          status: values.status,
          startDate: values.startDate,
        },
        ...prev,
      ])
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Error al crear préstamo"
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (loanId: string) => {
    setDeletingId(loanId)
    try {
      const res = await fetch("/api/loans/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId }),
      })
      if (!res.ok) throw new Error("No se pudo mover a eliminados")
      setLoans((prev) => prev.filter((l) => l.id !== loanId))
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Error al eliminar préstamo"
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleUpdate = async (values: LoanEditFormValues) => {
    try {
      const res = await fetch("/api/loans/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: values.id,
          amount: Number(values.amount),
          rate: Number(values.rate),
          termMonths: Number(values.termMonths),
          status: values.status,
          startDate: values.startDate,
        }),
      })
      if (!res.ok) throw new Error("No se pudo actualizar el préstamo")
      setLoans((prev) =>
        prev.map((loan) =>
          loan.id === values.id
            ? {
                ...loan,
                amount: Number(values.amount),
                rate: Number(values.rate),
                termMonths: Number(values.termMonths),
                status: values.status,
                startDate: values.startDate,
              }
            : loan
        )
      )
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Error al actualizar préstamo"
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight"> Préstamos</h2>
        <p className="text-muted-foreground mt-2">
          Gestiona y monitorea todos los préstamos activos y en proceso
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Dinero prestado</p>
              <p className="text-3xl font-bold mt-2">
                {formatCurrency(stats.total)}
              </p>
            </div>
            <div className="metric-icon"><DollarSign className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Préstamos Activos</p>
              <p className="text-3xl font-bold mt-2">{stats.active}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {loans.length ? ((stats.active / loans.length) * 100).toFixed(0) : 0}% de la cartera
              </p>
            </div>
            <div className="metric-icon"><CheckCircle2 className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Tasa Promedio</p>
              <p className="text-3xl font-bold mt-2">{stats.avgRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">Anualizada</p>
            </div>
            <div className="metric-icon"><TrendingUp className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">En Revisión</p>
              <p className="text-3xl font-bold mt-2">
                {stats.inReview}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
            </div>
            <div className="metric-icon"><AlertCircle className="h-5 w-5" /></div>
          </div>
        </Card>
      </div>

      {/* Cartera Table */}
      <Card className="animate-in fade-in slide-in-from-bottom-6 duration-700">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Listado de Préstamos</CardTitle>
            <LoanCreateDialog
              trigger={(
                <Button variant="default" size="sm" disabled={clients.length === 0 || isCreating}>
                  {isCreating ? "Creando..." : "Crear préstamo"}
                </Button>
              )}
              clients={clients}
              onCreate={handleCreate}
            />
          </div>
          <CardDescription>
            Detalle de todos los préstamos en cartera
          </CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Filtrar por nombre del cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-sm"
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="h-10 px-4 text-left align-middle font-medium">ID</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Cliente</th>
                  <th className="h-10 px-4 text-right align-middle font-medium">Monto</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Tasa</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Plazo</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Estado</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Días</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="h-14 px-4 text-center text-muted-foreground">Cargando préstamos...</td>
                  </tr>
                ) : loans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-14 px-4 text-center text-muted-foreground">Sin préstamos</td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                  <tr key={loan.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="h-14 px-4 align-middle font-medium text-xs">{loan.id}</td>
                    <td className="h-14 px-4 align-middle">{loan.clientName}</td>
                    <td className="h-14 px-4 align-middle text-right font-medium">
                      {formatCurrency(loan.amount)}
                    </td>
                    <td className="h-14 px-4 align-middle text-center">{loan.rate}%</td>
                    <td className="h-14 px-4 align-middle text-center">{loan.termMonths} meses</td>
                    <td className="h-14 px-4 align-middle">
                      <Badge
                        variant={
                          loan.status.toLowerCase().includes("activo")
                            ? "default"
                            : loan.status.toLowerCase().includes("revision") || loan.status.toLowerCase().includes("revisión")
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="h-14 px-4 align-middle text-center text-xs text-muted-foreground">
                      {daysSince(loan.startDate)}
                    </td>
                    <td className="h-14 px-4 align-middle text-center">
                      <div className="flex gap-2 justify-center">
                        <LoanEditDialog
                          trigger={
                            <Button variant="outline" size="sm" className="gap-2">
                              <Edit2 className="h-4 w-4" />
                              Editar
                            </Button>
                          }
                          loan={{
                            id: loan.id,
                            amount: String(loan.amount),
                            rate: String(loan.rate),
                            termMonths: String(loan.termMonths),
                            status: loan.status,
                            startDate: loan.startDate ?? "",
                          }}
                          onUpdate={handleUpdate}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={deletingId === loan.id}
                          onClick={() => handleDelete(loan.id)}
                        >
                          <Archive className="h-4 w-4" />
                          Archivar
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
