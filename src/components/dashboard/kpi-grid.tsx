import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type KpiCard = {
  title: string
  value: string
  description: string
  icon: LucideIcon
}

interface KpiGridProps {
  items: KpiCard[]
}

export function KpiGrid({ items }: KpiGridProps) {
  const getValueSize = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').length
    if (numericValue >= 7) return 'text-xl'
    if (numericValue >= 5) return 'text-2xl'
    return 'text-3xl'
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Card
          key={item.title}
          className="stat-card animate-in fade-in slide-in-from-bottom-4 duration-600"
          style={{ animationDelay: `${80 * index}ms` }}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardDescription>{item.title}</CardDescription>
              <CardTitle className={getValueSize(item.value)}>{item.value}</CardTitle>
            </div>
            <div className="metric-icon">
              <item.icon className="size-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
