import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type KpiCard = {
  title: string
  value: string
  description: string
  icon: LucideIcon
  /** "indigo" | "emerald" | "amber" | "rose" | "violet" */
  color?: "indigo" | "emerald" | "amber" | "rose" | "violet"
}

interface KpiGridProps {
  items: KpiCard[]
}

const colorMap = {
  indigo: {
    icon: "bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-800/50 dark:text-indigo-400",
    value: "text-indigo-600 dark:text-indigo-400",
    card: "border-indigo-100 dark:border-indigo-900/40",
    glow: "shadow-indigo-100/60 dark:shadow-indigo-900/30",
  },
  emerald: {
    icon: "bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-800/50 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    card: "border-emerald-100 dark:border-emerald-900/40",
    glow: "shadow-emerald-100/60 dark:shadow-emerald-900/30",
  },
  amber: {
    icon: "bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-950/60 dark:border-amber-800/50 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    card: "border-amber-100 dark:border-amber-900/40",
    glow: "shadow-amber-100/60 dark:shadow-amber-900/30",
  },
  rose: {
    icon: "bg-rose-100 border-rose-200 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800/50 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    card: "border-rose-100 dark:border-rose-900/40",
    glow: "shadow-rose-100/60 dark:shadow-rose-900/30",
  },
  violet: {
    icon: "bg-violet-100 border-violet-200 text-violet-600 dark:bg-violet-950/60 dark:border-violet-800/50 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
    card: "border-violet-100 dark:border-violet-900/40",
    glow: "shadow-violet-100/60 dark:shadow-violet-900/30",
  },
}

export function KpiGrid({ items }: KpiGridProps) {
  const getValueSize = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "").length
    if (numericValue >= 7) return "text-xl"
    if (numericValue >= 5) return "text-2xl"
    return "text-3xl"
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const colors = colorMap[item.color ?? "indigo"]
        return (
          <Card
            key={item.title}
            className={cn(
              "stat-card animate-in fade-in slide-in-from-bottom-4 duration-600",
              colors.card,
            )}
            style={{ animationDelay: `${80 * index}ms` }}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="space-y-1 min-w-0">
                <CardDescription className="text-xs font-medium">{item.title}</CardDescription>
                <CardTitle className={cn(getValueSize(item.value), "font-bold", colors.value)}>
                  {item.value}
                </CardTitle>
              </div>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                  colors.icon,
                )}
              >
                <item.icon className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-xs leading-relaxed">{item.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
