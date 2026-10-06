"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  Lock,
  Shield,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfiguredOnClient } from "@/lib/env-public";
import { fetchApi } from "@/lib/fetch-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const features = [
  { icon: Banknote, text: "Gestión de cartera de préstamos" },
  { icon: BarChart3, text: "Reportes y análisis en tiempo real" },
  { icon: TrendingUp, text: "Control de mora y capitalizaciones" },
  { icon: Shield, text: "Notificaciones automáticas WhatsApp" },
];

const stats = [
  { value: "100%", label: "Seguro" },
  { value: "24/7", label: "Disponible" },
  { value: "DR", label: "Enfocado" },
];

export default function LoginPage() {
  const router = useRouter();
  const [configRedirect, setConfigRedirect] = useState(false);
  const [inactiveError, setInactiveError] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConfigRedirect(params.get("config") === "1");
    setInactiveError(params.get("error") === "inactive");
  }, []);

  const hasSupabaseEnv = isSupabaseConfiguredOnClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    identificador: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!hasSupabaseEnv) {
        toast.error(
          "Configura las variables NEXT_PUBLIC_SUPABASE_* en el servidor",
        );
        return;
      }
      // Supabase Auth autentica por correo, pero la jerarquía identifica a
      // cada persona por su nombre de usuario. Si lo introducido no parece un
      // correo, se pide al servidor que lo traduzca. Cuando el usuario no
      // existe, la ruta devuelve lo mismo que recibió: el login falla después
      // con el error genérico de siempre y no se delata qué usuarios hay.
      let email = formData.identificador.trim();
      if (!email.includes("@")) {
        const res = await fetchApi<{ email: string }>(
          "/api/auth/identificador",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identificador: email }),
          },
        );
        if (res.ok) email = res.data.email;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });
      if (error) {
        toast.error(
          "Credenciales inválidas. Verifica tu usuario o correo y tu contraseña.",
        );
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: branding (hidden on mobile) ── */}
      <div
        className="relative hidden w-[55%] flex-col justify-between overflow-hidden p-10 lg:flex xl:w-[60%]"
        style={{ background: "#0A0E17" }}
      >
        {/* Background gradient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[120px]"
            style={{ background: "rgba(0,82,204,0.18)" }}
          />
          <div
            className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full blur-[100px]"
            style={{ background: "rgba(0,210,255,0.10)" }}
          />
        </div>
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,210,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,255,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
              boxShadow: "0 4px 16px rgba(0,82,204,0.5)",
            }}
          >
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight tracking-tight">
              Préstamos Elicar
            </p>
            <p className="text-xs" style={{ color: "#00D2FF" }}>
              Microfinanzas
            </p>
          </div>
        </div>

        {/* Center content */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="mb-3 text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
            Gestión de cartera
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #3385FF 0%, #00D2FF 100%)",
              }}
            >
              inteligente
            </span>
          </h1>
          <p className="mb-8 max-w-sm text-base text-white/50 leading-relaxed">
            Panel operativo completo para administrar préstamos, clientes,
            cobros y reportes desde un solo lugar.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.06]">
                  <Icon className="size-3.5" style={{ color: "#00D2FF" }} />
                </div>
                <span className="text-sm text-white/60">{text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom stats */}
        <div className="relative flex items-center gap-6">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span className="text-xs text-white/50">Sistema operativo</span>
          </div>
        </div>
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6">
        {/* Mobile brand */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
            }}
          >
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="font-bold text-foreground tracking-tight">
              Préstamos Elicar
            </p>
            <p className="text-xs text-muted-foreground">Microfinanzas</p>
          </div>
        </div>

        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Iniciar sesión
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accede a tu panel de operaciones
            </p>
          </div>

          {/* Alerts */}
          {(configRedirect || !hasSupabaseEnv) && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-xs">
                Configura{" "}
                <code className="rounded bg-destructive/10 px-1 text-[11px]">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{" "}
                y{" "}
                <code className="rounded bg-destructive/10 px-1 text-[11px]">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>{" "}
                en el hosting y vuelve a desplegar.
              </AlertDescription>
            </Alert>
          )}
          {inactiveError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-xs">
                Tu cuenta está desactivada. Contacta al administrador.
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identificador" className="text-sm font-medium">
                Usuario o correo
              </Label>
              <Input
                id="identificador"
                type="text"
                placeholder="tu.usuario  ·  correo@empresa.com"
                value={formData.identificador}
                onChange={(e) =>
                  setFormData({ ...formData, identificador: e.target.value })
                }
                required
                disabled={isLoading}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              className="mt-2 h-10 w-full gap-2 font-medium"
              disabled={isLoading || !hasSupabaseEnv}
            >
              {isLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar al panel
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" />
            <span>Acceso restringido · Préstamos Elicar</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
