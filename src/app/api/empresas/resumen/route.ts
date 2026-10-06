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

  const [{ count: total }, { count: conRnc }] = await Promise.all([
    supabase.from("empresas").select("id", { count: "exact", head: true }),
    supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .not("rnc", "is", null),
  ]);

  return NextResponse.json({
    total: total ?? 0,
    conRnc: conRnc ?? 0,
  });
}
