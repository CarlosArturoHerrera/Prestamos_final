import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "403 — Acceso denegado" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldX className="size-10" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Acceso denegado</h1>
        <p className="text-muted-foreground max-w-sm">
          No tienes permisos para acceder a esta sección. Si crees que esto es
          un error, contacta al Super Admin del sistema.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">Ir al Dashboard</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Error 403 — Forbidden</p>
    </div>
  );
}
