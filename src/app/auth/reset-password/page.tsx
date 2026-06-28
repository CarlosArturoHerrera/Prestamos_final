"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PageState = "loading" | "ready" | "submitting" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState("");

  // On mount, read the URL fragment that Supabase appends after OTP verification:
  // /auth/reset-password#access_token=...&refresh_token=...&type=recovery
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setState("invalid");
      return;
    }

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    // Supabase may include error info in the fragment if verification failed
    if (errorCode || errorDescription) {
      setState("invalid");
      return;
    }

    if (type === "recovery" && accessToken && refreshToken) {
      const supabase = createSupabaseBrowserClient();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setState("invalid");
          } else {
            setState("ready");
            // Remove tokens from the URL bar without causing a navigation
            window.history.replaceState(null, "", window.location.pathname);
          }
        });
    } else {
      setState("invalid");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");

    if (password.length < 8) {
      setFieldError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Las contraseñas no coinciden.");
      return;
    }

    setState("submitting");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFieldError(
        "No se pudo actualizar la contraseña. El enlace puede haber expirado; solicita uno nuevo.",
      );
      setState("ready");
      return;
    }

    // Sign out so the user must log in with the new password
    await supabase.auth.signOut();
    setState("success");

    // Redirect to login after a short delay so the user reads the success message
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, #0052CC 0%, #00D2FF 100%)",
              boxShadow: "0 4px 16px rgba(0,82,204,0.4)",
            }}
          >
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="font-bold tracking-tight text-foreground">
              Préstamos Elicar
            </p>
            <p className="text-xs text-muted-foreground">Microfinanzas</p>
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <KeyRound className="size-6" />
            Nueva contraseña
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        {/* States */}
        {state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" />
            Verificando enlace…
          </div>
        )}

        {state === "invalid" && (
          <Alert variant="destructive">
            <AlertDescription>
              El enlace de recuperación es inválido o ya expiró. Solicita al
              administrador que te envíe un nuevo correo de recuperación.
            </AlertDescription>
          </Alert>
        )}

        {state === "success" && (
          <Alert>
            <AlertDescription>
              ✅ Contraseña actualizada correctamente. Redirigiendo al inicio de
              sesión…
            </AlertDescription>
          </Alert>
        )}

        {(state === "ready" || state === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {fieldError && (
              <Alert variant="destructive">
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={state === "submitting"}
                autoComplete="new-password"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={state === "submitting"}
                autoComplete="new-password"
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              className="h-10 w-full gap-2 font-medium"
              disabled={state === "submitting"}
            >
              {state === "submitting" ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  Actualizando…
                </>
              ) : (
                "Establecer nueva contraseña"
              )}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          <span>Acceso restringido · Préstamos Elicar</span>
        </div>
      </div>
    </div>
  );
}
