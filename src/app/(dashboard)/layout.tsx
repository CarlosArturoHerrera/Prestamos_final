import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { AvisosIsla } from "@/components/app/avisos-isla";
import { PageTransition } from "@/components/app/page-transition";
import { PermisosProvider } from "@/components/providers/permisos-provider";
import { getUserAndRole } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) {
    redirect("/login");
  }

  // Inactive accounts cannot access the dashboard
  if (!session.isActive) {
    redirect("/login?error=inactive");
  }

  return (
    // Los permisos se resuelven en el servidor y bajan por contexto: asi un
    // boton que el usuario no puede usar no llega a pintarse nunca, en vez de
    // aparecer y desaparecer mientras se consulta el perfil.
    <PermisosProvider role={session.role} permissions={session.permissions}>
      <AppShell role={session.role} permissions={session.permissions}>
        {/* Mantenimiento y mensajes del megaadministrador (§22, §23).
          Se renderiza fuera de PageTransition para que no se reanime en cada
          navegación: es un aviso de sesión, no contenido de la página. */}
        <AvisosIsla />
        <PageTransition>{children}</PageTransition>
      </AppShell>
    </PermisosProvider>
  );
}
