import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface HeroSectionProps {
  title: string
  subtitle: string
  highlightBadges: string[]
  onLogout?: () => void
}

export function HeroSection({
  title,
  subtitle,
  highlightBadges,
  onLogout,
}: HeroSectionProps) {
  return (
    <section className="hero-surface relative overflow-hidden rounded-[2rem] px-6 py-8 animate-in fade-in slide-in-from-bottom-6 duration-700 sm:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_78%_0%,rgba(96,165,250,0.16),transparent_30%),radial-gradient(circle_at_40%_82%,rgba(219,234,254,0.8),transparent_28%)] dark:[background:radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_78%_0%,rgba(96,165,250,0.14),transparent_30%),radial-gradient(circle_at_40%_82%,rgba(17,24,39,0.2),transparent_28%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="size-2 rounded-full bg-primary" />
            Panel de riesgo y crecimiento
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {highlightBadges.map((text) => (
              <Badge key={text} variant="outline" className="bg-white/45 dark:bg-white/5">
                {text}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            className="backdrop-blur"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </section>
  )
}
