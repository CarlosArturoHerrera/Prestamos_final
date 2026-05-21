"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banknote, Lock, Sparkles, TrendingUp } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isSupabaseConfiguredOnClient } from "@/lib/env-public"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [configRedirect, setConfigRedirect] = useState(false)
  useEffect(() => {
    setConfigRedirect(new URLSearchParams(window.location.search).get("config") === "1")
  }, [])
  const hasSupabaseEnv = isSupabaseConfiguredOnClient()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ email: "", password: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!hasSupabaseEnv) {
        toast.error("Falta configurar Supabase en el servidor (variables NEXT_PUBLIC_*)")
        return
      }
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      if (error) {
        toast.error("Credenciales inválidas")
      } else {
        toast.success("Inicio de sesión exitoso")
        router.push("/")
        router.refresh()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al iniciar sesión"
      toast.error(msg.includes("Faltan NEXT") ? "Configura Supabase (variables NEXT_PUBLIC_*) en el hosting." : msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0f0e2a]">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[36rem] w-[36rem] rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-[28rem] w-[28rem] -translate-y-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-indigo-400/15 blur-[80px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(129,140,248,1) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6">
        {/* Card */}
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Logo / brand */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_8px_32px_rgba(99,102,241,0.5)]">
                <TrendingUp className="size-8 text-white" />
              </div>
              <div className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-lg bg-emerald-500 shadow-lg">
                <Sparkles className="size-3.5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Microfinanzas</h1>
              <p className="mt-1 text-sm text-indigo-300/80">Panel de gestión de cartera</p>
            </div>
          </div>

          {/* Config alert */}
          {(configRedirect || !hasSupabaseEnv) && (
            <div className="mb-4">
              <Alert variant="destructive" className="border-rose-500/40 bg-rose-950/60 text-rose-300">
                <AlertTitle className="text-rose-300">Configuración de Supabase</AlertTitle>
                <AlertDescription className="text-xs text-rose-400">
                  Define{" "}
                  <code className="rounded bg-rose-900/60 px-1">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
                  <code className="rounded bg-rose-900/60 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                  en Vercel y vuelve a desplegar.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Form card */}
          <div className="rounded-2xl border border-indigo-500/20 bg-white/5 p-6 shadow-[0_24px_64px_rgba(8,7,23,0.6)] backdrop-blur-xl sm:p-8">
            {/* Feature chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              {[
                { icon: Banknote, label: "Préstamos" },
                { icon: TrendingUp, label: "Cartera" },
                { icon: Lock, label: "Seguro" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300"
                >
                  <Icon className="size-3" />
                  {label}
                </div>
              ))}
            </div>

            <h2 className="mb-1 text-xl font-bold text-white">Iniciar sesión</h2>
            <p className="mb-6 text-sm text-indigo-300/70">Accede a tu panel de operaciones</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-indigo-200">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="border-indigo-500/25 bg-indigo-950/40 text-white placeholder:text-indigo-400/50 focus:border-indigo-500/60 focus:ring-indigo-500/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-indigo-200">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="border-indigo-500/25 bg-indigo-950/40 text-white placeholder:text-indigo-400/50 focus:border-indigo-500/60 focus:ring-indigo-500/30"
                />
              </div>
              <Button
                type="submit"
                className="mt-2 w-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_6px_28px_rgba(99,102,241,0.55)] transition-all duration-200"
                disabled={isLoading || !hasSupabaseEnv}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar al panel"
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-[11px] text-indigo-400/50">
            Sistema de gestión de microfinanzas · Acceso restringido
          </p>
        </div>
      </div>
    </div>
  )
}
