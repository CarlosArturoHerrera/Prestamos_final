import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LogOut, TrendingUp } from "lucide-react"

interface HeroSectionProps {
  title: string
  subtitle: string
  highlightBadges: string[]
  onLogout?: () => void
}

export function HeroSection({ title, subtitle, highlightBadges, onLogout }: HeroSectionProps) {
  return (
    <section className="hero-surface relative overflow-hidden rounded-3xl px-6 py-7 animate-in fade-in slide-in-from-bottom-6 duration-700 sm:px-8 sm:py-8">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-8 -right-8 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/14" />
        <div className="absolute bottom-0 left-1/4 h-32 w-64 rounded-full bg-violet-500/8 blur-2xl dark:bg-violet-500/12" />
      </div>

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          {/* Status chip */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <TrendingUp className="size-3" />
            Panel de riesgo y crecimiento
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>

          {/* Badges */}
          {highlightBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {highlightBadges.map((text) => (
                <Badge
                  key={text}
                  variant="outline"
                  className="border-primary/18 bg-white/60 text-xs font-medium text-foreground/80 dark:bg-white/5"
                >
                  {text}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {onLogout && (
          <Button
            variant="outline"
            size="sm"
            className="self-start backdrop-blur lg:self-auto"
            onClick={onLogout}
          >
            <LogOut className="mr-2 size-4" />
            Cerrar sesión
          </Button>
        )}
      </div>
    </section>
  )
}
