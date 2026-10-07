import { redirect } from "next/navigation";
import { AuditoriaTable } from "@/components/admin/auditoria-table";
import { getUserAndRole } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Auditoría" };

/**
 * Registro de acciones administrativas (§28). Exclusivo del megaadministrador.
 *
 * La comprobación de rol en el servidor es la que vale; el middleware ya corta
 * /admin/* para cualquier otro rol, y la ruta API vuelve a verificarlo.
 */
export default async function AuditoriaPage() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) redirect("/login");
  if (!session.isActive) redirect("/login?error=inactive");
  if (session.role !== "super_admin") redirect("/403");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Auditoría
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quién hizo qué sobre las cuentas de la plataforma.
        </p>
      </div>

      <AuditoriaTable />
    </div>
  );
}
