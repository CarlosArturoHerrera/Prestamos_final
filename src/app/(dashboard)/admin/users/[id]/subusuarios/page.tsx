import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubusuariosPanel } from "@/components/subusuarios/subusuarios-panel";
import { Button } from "@/components/ui/button";
import { getUserAndRole } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Subusuarios del administrador" };

type Props = { params: Promise<{ id: string }> };

/**
 * Subusuarios de UN administrador, gestionados por el megaadministrador (§2).
 *
 * Reutiliza el mismo panel que ve el administrador en /subusuarios; la única
 * diferencia es que aquí se le pasa `adminId`. La API sólo honra ese parámetro
 * cuando quien llama es megaadministrador, así que pasarlo no concede nada por
 * sí mismo.
 *
 * Esto NO abre la puerta a los datos del administrador: gestionar sus cuentas
 * de acceso no es ver sus clientes ni sus préstamos (§11, §12).
 */
export default async function SubusuariosDeAdminPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) redirect("/login");
  if (!session.isActive) redirect("/login?error=inactive");
  if (session.role !== "super_admin") redirect("/403");

  const db = createSupabaseAdminClient();
  const { data: admin } = await db
    .from("profiles")
    .select("id, full_name, username, email, role, is_active")
    .eq("id", id)
    .eq("role", "admin")
    .maybeSingle();

  if (!admin) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 h-8 gap-1.5 text-muted-foreground"
        >
          <Link href="/admin/users">
            <ArrowLeft className="size-4" />
            Administradores
          </Link>
        </Button>

        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Subusuarios de {admin.full_name ?? admin.username ?? admin.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuentas de acceso dentro de la organización de este administrador.
          {!admin.is_active &&
            " La cuenta está deshabilitada, así que ninguno de ellos puede iniciar sesión."}
        </p>
      </div>

      <SubusuariosPanel adminId={admin.id} />
    </div>
  );
}
