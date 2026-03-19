"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { ShieldCheck } from "lucide-react"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { ChartConfig } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"

export type PortfolioPoint = { month: string; prestado: number; cobrado: number }

export type PortfolioMetric = {
  label: string
  value: string
  helper: string
  progress: number
  progressClassName?: string
  helperClassName?: string
}

interface PortfolioChartCardProps {
  title?: string
  description?: string
  data: PortfolioPoint[]
  chartConfig: ChartConfig
  metrics: PortfolioMetric[]
  badgeText?: string
  badgeIcon?: LucideIcon
}

export function PortfolioChartCard({
  title = "Flujo de dinero",
  description = "Prestado vs Cobrado por mes",
  data,
  chartConfig,
  metrics,
  badgeText = "Datos actualizados",
  badgeIcon: BadgeIcon = ShieldCheck,
}: PortfolioChartCardProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-left-6 duration-700">
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardDescription>{description}</CardDescription>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <Badge variant="outline" className="gap-1 text-xs bg-white/45 dark:bg-white/5">
          <BadgeIcon className="size-3.5" /> {badgeText}
        </Badge>
      </CardHeader>
      <CardContent className="overflow-hidden px-4 sm:px-6 py-6">
        <ChartContainer config={chartConfig} className="h-50 sm:h-62.5 md:h-75 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area
              type="monotone"
              dataKey="prestado"
              stroke="var(--color-prestado)"
              fill="var(--color-prestado)"
              fillOpacity={0.16}
              strokeWidth={2.2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="cobrado"
              stroke="var(--color-cobrado)"
              fill="var(--color-cobrado)"
              fillOpacity={0.12}
              strokeWidth={2.2}
              dot={false}
            />
            <ChartLegend
              verticalAlign="top"
              height={36}
              content={<ChartLegendContent payload={[]} />}
            />
          </AreaChart>
        </ChartContainer>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <p className="text-muted-foreground text-xs">{metric.label}</p>
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{metric.value}</span>
                <span className={metric.helperClassName}>{metric.helper}</span>
              </div>
              <Progress value={metric.progress} className={metric.progressClassName} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
