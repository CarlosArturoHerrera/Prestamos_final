import { redirect } from "next/navigation";
import { SubusuariosPanel } from "@/components/subusuarios/subusuarios-panel";
import { getUserAndRole } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Subusuarios" };

/**
 * Gestión de SUBUSUARIOS de la organización (§13, §19).
 *
 * La comprobación de rol en el servidor es la que vale: un subusuario no
 * gestiona subusuarios, y el megaadministrador usa su propio panel de
 * administradores, donde elige la organización sobre la que actúa.
 */
export default async function SubusuariosPage() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) redirect("/login");
  if (!session.isActive) redirect("/login?error=inactive");
  if (session.role !== "admin") redirect("/403");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Subusuarios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personas que trabajan dentro de tu organización.
        </p>
      </div>

      <SubusuariosPanel />
    </div>
  );
}
