import { Bell, LineChart } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

interface OperationsCardProps {
  scheduledAmount: string
  operationsCount: number
  expectedRecoveries: string
  digitalPercentage: number
  cashPercentage: number
  alertText: string
  alertDetail: string
}

export function OperationsCard({
  scheduledAmount,
  operationsCount,
  expectedRecoveries,
  digitalPercentage,
  cashPercentage,
  alertText,
  alertDetail,
}: OperationsCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur animate-in fade-in slide-in-from-right-6 duration-700">
      <CardHeader>
        <CardDescription>Operación diaria</CardDescription>
        <CardTitle className="text-xl">Colocación y cobro hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Desembolsos agendados</p>
            <p className="font-semibold">{scheduledAmount}</p>
            <span className="text-muted-foreground">{operationsCount} operaciones</span>
          </div>
          <div className="bg-primary/10 text-primary border-primary/30 flex size-12 items-center justify-center rounded-lg border">
            <LineChart className="size-5" />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border px-4 py-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Recuperaciones esperadas</span>
            <span>{expectedRecoveries}</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Cobro digital</span>
              <span>{digitalPercentage}%</span>
            </div>
            <Progress value={digitalPercentage} />
            <div className="flex items-center justify-between pt-1">
              <span>Caja presencial</span>
              <span>{cashPercentage}%</span>
            </div>
            <Progress value={cashPercentage} className="bg-secondary" />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="bg-orange-500/10 text-orange-600 dark:text-orange-300 flex size-10 items-center justify-center rounded-full">
            <Bell className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{alertText}</p>
            <p className="text-muted-foreground text-xs">{alertDetail}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto">
            Revisar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
