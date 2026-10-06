import { NextResponse } from "next/server";
import { getUserAndRole, soloOrganizacion, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  const [{ count: totalRepresentantes }, { count: totalClientesVinculados }] =
    await Promise.all([
      supabase
        .from("representantes")
        .select("id", { count: "exact", head: true }),
      supabase.from("clientes").select("id", { count: "exact", head: true }),
    ]);

  return NextResponse.json({
    totalRepresentantes: totalRepresentantes ?? 0,
    totalClientesVinculados: totalClientesVinculados ?? 0,
  });
}
