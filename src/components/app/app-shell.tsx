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
  Menu,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  UserCircle,
  Users,
  X,
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
  { href: "/representantes", label: "Reps.", icon: Users },
  { href: "/clientes", label: "Clientes", icon: UserCircle },
  { href: "/prestamos", label: "Préstamos", icon: Banknote },
  { href: "/notificaciones", label: "Notifs.", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
] as const

/* Bottom nav shows first 4 items + "Más" */
const BOTTOM_NAV_ITEMS = 4

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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const sideNavItemClass = (active: boolean, collapsed = false) =>
    cn(
      "flex items-center rounded-xl text-sm font-medium transition-all duration-150",
      collapsed ? "justify-center px-2.5 py-2.5" : "gap-3 px-3 py-2.5",
      active
        ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
    )

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar p-3 transition-[width,padding] duration-300 md:flex md:flex-col overflow-y-auto",
          sidebarCollapsed ? "w-[68px]" : "w-56 p-4",
        )}
      >
        {/* Brand */}
        <div className={cn("mb-5", sidebarCollapsed ? "flex justify-center" : "px-1")}>
          {sidebarCollapsed ? (
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
              <TrendingUp className="size-5" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  Préstamos
                </p>
                <p className="text-base font-bold leading-tight text-sidebar-foreground">Elicar</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex flex-1 flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const linkNode = (
              <Link key={item.href} href={item.href} className={sideNavItemClass(active, sidebarCollapsed)}>
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && active && (
                  <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />
                )}
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

        {/* Logout */}
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mt-4 self-center text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                onClick={logout}
              >
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Salir</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="mt-4 gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        )}
      </aside>

      {/* ── Main content area ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <header className="z-30 flex shrink-0 items-center justify-between border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            {/* Desktop: toggle sidebar | Mobile: open drawer */}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl md:flex hidden"
              aria-label="Abrir/cerrar menú lateral"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              <Menu className="size-4.5" />
            </Button>

            {/* Brand mark in header */}
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/12 text-primary md:hidden">
                <TrendingUp className="size-4" />
              </div>
              <p className="font-bold text-foreground">Préstamos Elicar</p>
            </div>
          </div>

          {/* Header right actions */}
          <div className="flex items-center gap-1">
            {/* AI chat button — visible on desktop in header too */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-9 rounded-xl md:flex"
              aria-label="Asistente IA"
              onClick={() => {
                if (!chatMounted) setChatMounted(true)
                setChatOpen((o) => !o)
              }}
            >
              <Sparkles className="size-4 text-primary" />
            </Button>

            {/* Mobile: hamburger for full menu drawer */}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl md:hidden"
              aria-label="Más opciones"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <MoreHorizontal className="size-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <div className="page-shell flex-1 overflow-y-auto p-4 pb-safe md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />
      {/* Mobile full sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-sidebar-border bg-sidebar p-4 shadow-2xl transition-transform duration-300 md:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">Préstamos</p>
              <p className="text-base font-bold text-sidebar-foreground">Elicar</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href} className={sideNavItemClass(active)}>
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 space-y-2 border-t border-sidebar-border pt-4">
          <Button
            variant="ghost"
            className="w-full gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={() => {
              setMobileSidebarOpen(false)
              if (!chatMounted) setChatMounted(true)
              setChatOpen(true)
            }}
          >
            <Sparkles className="size-4 text-sidebar-primary" />
            Asistente IA
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        </div>
      </aside>

      {/* ── Mobile bottom navigation bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/60 bg-white/95 shadow-[0_-4px_20px_rgba(99,102,241,0.1)] backdrop-blur-xl dark:bg-surface/95 md:hidden">
        {nav.slice(0, BOTTOM_NAV_ITEMS).map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "bottom-nav-item",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div className={cn("bottom-nav-item-icon", active && "bg-primary/12 text-primary")}>
                <Icon className="size-5" />
              </div>
              <span className={cn(active && "font-semibold")}>{item.label}</span>
            </Link>
          )
        })}
        {/* "Más" button opens full drawer */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className={cn(
            "bottom-nav-item",
            "text-muted-foreground",
          )}
        >
          <div className="bottom-nav-item-icon">
            <MoreHorizontal className="size-5" />
          </div>
          <span>Más</span>
        </button>
      </nav>

      {/* ── AI chat FAB (desktop only) ── */}
      {!chatOpen && (
        <Button
          className="fixed bottom-6 right-6 z-40 hidden h-12 w-12 rounded-full border border-primary/20 p-0 shadow-[0_10px_30px_rgba(99,102,241,0.32)] md:flex"
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
