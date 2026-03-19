"use client"

import { Users, TrendingUp, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ClientsHeroSectionProps {
  totalClients: number
  activeClients: number
}

export function ClientsHeroSection({
  totalClients,
  activeClients,
}: ClientsHeroSectionProps) {
  const atRiskClients = totalClients - activeClients

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Clientes personales</h2>
        <p className="text-muted-foreground mt-2">
          Gestiona y monitorea tu cartera de préstamos a personas en un solo lugar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total de clientes</p>
              <p className="text-3xl font-bold mt-2">{totalClients}</p>
            </div>
            <div className="metric-icon">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Clientes activos</p>
              <p className="text-3xl font-bold mt-2">{activeClients}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((activeClients / totalClients) * 100)}% de la cartera
              </p>
            </div>
            <div className="metric-icon">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">En riesgo</p>
              <p className="text-3xl font-bold mt-2">{atRiskClients}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((atRiskClients / totalClients) * 100)}% requiere atención
              </p>
            </div>
            <div className="metric-icon">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
