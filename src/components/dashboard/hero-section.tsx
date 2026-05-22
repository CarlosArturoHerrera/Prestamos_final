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
      {/* Decorative glows on the gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-48 rounded-full bg-white/8 blur-2xl" />
      </div>

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          {/* Status chip — texto blanco sobre gradiente oscuro */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
            <TrendingUp className="size-3" />
            Panel de riesgo y crecimiento
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/75">{subtitle}</p>
          </div>

          {/* Badges — fondo semitransparente blanco sobre gradiente */}
          {highlightBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {highlightBadges.map((text) => (
                <Badge
                  key={text}
                  variant="outline"
                  className="border-white/30 bg-white/15 text-white hover:bg-white/20"
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
            className="self-start border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white lg:self-auto"
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
