"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  UserCircle,
  Users,
} from "lucide-react"
import { createSupabaseBrowserClient, isSupabaseConfiguredOnClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AIChatSidebar } from "@/components/dashboard/chat-sidebar"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/representantes", label: "Representantes", icon: Users },
  { href: "/clientes", label: "Clientes", icon: UserCircle },
  { href: "/prestamos", label: "Préstamos", icon: Banknote },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    try {
      if (isSupabaseConfiguredOnClient()) {
        const supabase = createSupabaseBrowserClient()
        await supabase.auth.signOut({ scope: "local" })
      }
    } catch {
      /* sin env o error de red: igual salimos al login */
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-56 shrink-0 border-r border-border/60 bg-card/40 p-4 md:flex md:flex-col">
        <div className="mb-6 px-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cartera</p>
          <p className="text-lg font-bold text-foreground">Microfinanzas</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Button variant="outline" className="mt-4 gap-2" onClick={logout}>
          <LogOut className="size-4" />
          Salir
        </Button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 md:hidden">
          <p className="font-semibold">Microfinanzas</p>
          <Button size="sm" variant="ghost" onClick={logout}>
            Salir
          </Button>
        </header>
        <div className="page-shell flex-1 p-4 md:p-8">{children}</div>
      </div>

      <AIChatSidebar />
    </div>
  )
}
