"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Sparkles,
  X,
  UserCircle,
  Users,
} from "lucide-react"
import { createSupabaseBrowserClient, isSupabaseConfiguredOnClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const AIChatSidebar = dynamic(
  () => import("@/components/dashboard/chat-sidebar").then((m) => m.AIChatSidebar),
  { ssr: false },
)

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
  const [chatMounted, setChatMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("elicar.sidebar.collapsed")
      setSidebarCollapsed(stored === "true")
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("elicar.sidebar.collapsed", String(sidebarCollapsed))
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

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

  const navItemClass = (active: boolean, collapsed = false) =>
    cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors",
      collapsed ? "justify-center px-2.5 py-2.5" : "gap-2 px-3 py-2",
      active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/60",
    )

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border/60 bg-card/40 p-3 transition-[width,padding] duration-300 md:flex md:flex-col",
          sidebarCollapsed ? "w-[74px]" : "w-56 p-4",
        )}
      >
        <div className={cn("mb-4", sidebarCollapsed ? "px-0" : "px-1")}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cartera</p>
          {!sidebarCollapsed && <p className="text-lg font-bold text-foreground">Microfinanzas</p>}
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            const linkNode = (
              <Link key={item.href} href={item.href} className={navItemClass(active, sidebarCollapsed)}>
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            )

            if (!sidebarCollapsed) return linkNode
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="mt-4 self-center" onClick={logout}>
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Salir</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="outline" className="mt-4 gap-2" onClick={logout}>
            <LogOut className="size-4" />
            Salir
          </Button>
        )}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir/cerrar menú lateral"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileSidebarOpen((prev) => !prev)
                } else {
                  setSidebarCollapsed((prev) => !prev)
                }
              }}
            >
              <PanelLeft className="size-5" />
            </Button>
            <p className="font-semibold">Microfinanzas</p>
          </div>
          <Button size="sm" variant="ghost" className="md:hidden" onClick={logout}>
            Salir
          </Button>
        </header>

        <div className="page-shell flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden",
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur transition-transform duration-300 md:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cartera</p>
            <p className="text-lg font-bold text-foreground">Microfinanzas</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label="Cerrar menú">
            <X className="size-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className={navItemClass(active)}>
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <Button variant="outline" className="mt-4 gap-2" onClick={logout}>
          <LogOut className="size-4" />
          Salir
        </Button>
      </aside>

      {!chatOpen && (
        <Button
          className="fixed bottom-4 left-4 z-40 h-11 w-11 rounded-full border border-primary/20 p-0 shadow-[0_10px_28px_rgba(59,130,246,0.26)] sm:bottom-6 sm:left-6 sm:h-12 sm:w-12"
          onClick={() => {
            if (!chatMounted) setChatMounted(true)
            setChatOpen(true)
          }}
          aria-label="Preguntar a la IA"
        >
          <Sparkles className="size-5" />
        </Button>
      )}
      {chatMounted && (
        <AIChatSidebar forceOpen={chatOpen} showLauncher={false} onRequestClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
