"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings2,
  TrendingUp,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import {
  createSupabaseBrowserClient,
  isSupabaseConfiguredOnClient,
} from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isSuperAdmin } from "@/lib/roles";
import type { AppRole } from "@/lib/api-auth";

const navBase = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/representantes", label: "Representantes", icon: Users },
  { href: "/clientes", label: "Clientes", icon: UserCircle },
  { href: "/prestamos", label: "Préstamos", icon: Banknote },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
] as const;

const navAdminItem = {
  href: "/admin/users",
  label: "Usuarios",
  icon: Settings2,
} as const;

const BOTTOM_NAV_ITEMS = 4;

interface AppShellProps {
  children: React.ReactNode;
  role?: AppRole | null;
}

export function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const superAdmin = isSuperAdmin(role);
  const nav = superAdmin ? [...navBase, navAdminItem] : navBase;

  // Current page label for header breadcrumb
  const currentNav = [...nav]
    .reverse()
    .find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    );

  useEffect(() => {
    try {
      const stored = localStorage.getItem("elicar.sidebar.collapsed");
      setSidebarCollapsed(stored === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "elicar.sidebar.collapsed",
        String(sidebarCollapsed),
      );
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const logout = async () => {
    try {
      if (isSupabaseConfiguredOnClient()) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const navItemClass = (active: boolean, collapsed = false) =>
    cn(
      "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
      collapsed ? "justify-center size-9 mx-auto" : "gap-3 px-3 py-2",
      active
        ? "bg-sidebar-accent text-sidebar-primary font-semibold"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
    );

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:flex md:flex-col",
          sidebarCollapsed ? "w-[60px]" : "w-[220px]",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border",
            sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-4",
          )}
        >
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
              }}
            />
            <TrendingUp className="relative size-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-sidebar-foreground leading-tight tracking-tight">
                Elicar
              </p>
              <p
                className="truncate text-[10px] leading-tight"
                style={{ color: "var(--sidebar-primary)" }}
              >
                Microfinanzas
              </p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 overflow-y-auto py-3",
            sidebarCollapsed ? "px-2" : "px-3",
          )}
        >
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isAdminItem = item.href === "/admin/users";

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  navItemClass(active, sidebarCollapsed),
                  isAdminItem &&
                    !sidebarCollapsed &&
                    "mt-3 border-t border-sidebar-border pt-3",
                  isAdminItem && sidebarCollapsed && "mt-3",
                )}
              >
                {active && !sidebarCollapsed && (
                  <span className="nav-active-indicator" />
                )}
                <Icon
                  className={cn(
                    "shrink-0",
                    sidebarCollapsed ? "size-[18px]" : "size-4",
                  )}
                />
                {!sidebarCollapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
              </Link>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>

        {/* Collapse toggle + logout */}
        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border py-3",
            sidebarCollapsed
              ? "flex flex-col items-center gap-1 px-2"
              : "px-3 space-y-1",
          )}
        >
          {sidebarCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(false)}
                    className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                    aria-label="Expandir sidebar"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Expandir
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                    aria-label="Salir"
                  >
                    <LogOut className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Salir
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
              >
                <ChevronLeft className="size-4" />
                <span>Colapsar</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="size-4" />
                <span>Salir</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Top header */}
        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* Mobile: hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg md:hidden"
              aria-label="Abrir menú"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            {/* Desktop: sidebar toggle + brand on mobile */}
            <button
              type="button"
              className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:flex"
              aria-label="Abrir/cerrar sidebar"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              <Menu className="size-4" />
            </button>
            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="relative flex size-7 items-center justify-center rounded-lg overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
                  }}
                />
                <TrendingUp className="relative size-3.5 text-white" />
              </div>
              <span className="font-bold text-sm text-foreground tracking-tight">
                Elicar
              </span>
            </div>
            {/* Desktop: current page name */}
            {currentNav && (
              <span className="hidden text-sm font-medium text-foreground md:block">
                {currentNav.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle className="size-8 rounded-lg" />
            {/* Mobile: more menu */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg md:hidden"
              aria-label="Más opciones"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 pb-safe md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-8 items-center justify-center rounded-lg overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
                }}
              />
              <TrendingUp className="relative size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground tracking-tight">
                Elicar
              </p>
              <p
                className="text-[10px]"
                style={{ color: "var(--sidebar-primary)" }}
              >
                Microfinanzas
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isAdminItem = item.href === "/admin/users";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  navItemClass(active),
                  isAdminItem && "mt-3 border-t border-sidebar-border pt-3",
                )}
              >
                {active && <span className="nav-active-indicator" />}
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
            onClick={logout}
          >
            <LogOut className="size-4" />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 shadow-[0_-1px_0_0_var(--border)] backdrop-blur-xl md:hidden">
        {navBase.slice(0, BOTTOM_NAV_ITEMS).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "bottom-nav-item",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "bottom-nav-item-icon",
                  active && "bg-accent text-primary",
                )}
              >
                <Icon className="size-5" />
              </div>
              <span className={cn(active && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="bottom-nav-item text-muted-foreground"
        >
          <div className="bottom-nav-item-icon">
            <MoreHorizontal className="size-5" />
          </div>
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
