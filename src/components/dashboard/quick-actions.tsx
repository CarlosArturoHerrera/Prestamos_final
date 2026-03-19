"use client"

import { Plus, UserPlus, Moon, Sun } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClientCreateDialog } from "@/components/dashboard/client-create-dialog"
import { LoanCreateDialog, type LoanFormValues } from "@/components/dashboard/loan-create-dialog"
import type { Client } from "@/lib/types/client"

export function QuickActions() {
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [isCreatingLoan, setIsCreatingLoan] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" })
        if (!res.ok) throw new Error("No se pudieron cargar los clientes")
        const payload = await res.json() as Array<{ id: string; name: string }>
        setClients(payload.map((client) => ({ id: client.id, name: client.name })))
      } catch (error) {
        console.error(error)
      }
    }

    loadClients()
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light")
  }

  const handleCreateLoan = async (values: LoanFormValues) => {
    setIsCreatingLoan(true)
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
      console.log("Préstamo creado exitosamente")
    } catch (error) {
      console.error(error)
    } finally {
      setIsCreatingLoan(false)
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur animate-in fade-in slide-in-from-bottom-6 duration-700">
      <CardHeader>
        <CardTitle className="text-lg">Acciones rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LoanCreateDialog
            trigger={(
              <Button
                variant="default"
                className="h-auto py-3 px-4 justify-start gap-3"
                disabled={clients.length === 0 || isCreatingLoan}
              >
                <Plus className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-sm">Nuevo préstamo</div>
                  <div className="text-xs opacity-60">Registrar un desembolso</div>
                </div>
              </Button>
            )}
            clients={clients}
            onCreate={handleCreateLoan}
          />

          <ClientCreateDialog
            trigger={(
              <Button
                variant="secondary"
                className="h-auto py-3 px-4 justify-start gap-3"
              >
                <UserPlus className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-sm">Nuevo cliente</div>
                  <div className="text-xs opacity-60">Crear cliente personal</div>
                </div>
              </Button>
            )}
            onCreate={(client) => {
              console.log("Cliente creado", client)
            }}
          />

          <Button
            variant="outline"
            className="h-auto py-3 px-4 justify-start gap-3"
            onClick={toggleTheme}
          >
            {resolvedTheme === "light" ? (
              <Moon className="h-5 w-5 shrink-0" />
            ) : (
              <Sun className="h-5 w-5 shrink-0" />
            )}
            <div className="text-left">
              <div className="font-medium text-sm">Cambiar tema</div>
              <div className="text-xs opacity-60">
                {resolvedTheme === "light" ? "Oscuro" : "Claro"}
              </div>
            </div>
          </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
