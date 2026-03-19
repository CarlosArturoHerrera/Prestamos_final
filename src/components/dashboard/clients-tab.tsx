"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ClientsHeroSection } from "./clients-hero-section"
import { ClientsDataTable } from "./clients-data-table"
import { ClientCreateDialog } from "./client-create-dialog"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"
import type { Client } from "@/lib/types/client"

export function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const debouncedSearch = useDebounce(searchTerm, 350)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    const loadClients = async () => {
      try {
        const params = new URLSearchParams()
        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim())
        }
        const response = await fetch(`/api/clients${params.toString() ? `?${params.toString()}` : ""}`, {
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error("No se pudieron cargar los clientes")
        }
        const data: Client[] = await response.json()
        if (isMounted) {
          setClients(
            data.map((client) => ({
              ...client,
              notes: client.notes?.trim() || "Sin notas",
              location: client.location?.trim() || "Sin ubicación",
            })),
          )
        }
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : "Error al cargar clientes"
        toast.error(message)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadClients()
    return () => {
      isMounted = false
    }
  }, [debouncedSearch])

  const heroStats = useMemo(() => {
    const total = clients.length
    const active = clients.filter((client) => client.status.toLowerCase().includes("al día")).length
    return {
      total,
      active,
    }
  }, [clients])

  const handleDeleteClient = (id: string) => {
    setClients(clients.filter((client) => client.id !== id))
  }

  return (
    <div className="space-y-6">
      <ClientsHeroSection totalClients={heroStats.total} activeClients={heroStats.active} />

      <Card className="bg-card/80 dark:border-border/40 backdrop-blur animate-in fade-in slide-in-from-bottom-6 duration-700">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Préstamos personales</CardTitle>
            <ClientCreateDialog
              trigger={<Button variant="default" size="sm">Crear cliente</Button>}
              onCreate={(client) => setClients((prev) => [client, ...prev])}
            />
          </div>
          <CardDescription>
            Administra tu cartera de clientes con búsqueda, filtros y acciones rápidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsDataTable
            data={clients}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onDeleteClient={handleDeleteClient}
            onUpdateClient={(client) => {
              setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)))
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
