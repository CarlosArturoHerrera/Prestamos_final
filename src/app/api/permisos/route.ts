import { NextResponse } from "next/server";
import { forbidden, getUserAndRole, unauthorized } from "@/lib/api-auth";
import { MODULE_LABELS, MODULE_ORDER, PERMISSIONS } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/permisos — catálogo de permisos para el formulario de subusuarios.
 *
 * Es sólo el catálogo: no revela qué permisos tiene nadie. Lo consumen los
 * administradores y el megaadministrador al construir la lista de casillas.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  // Un subusuario no gestiona permisos, así que no necesita el catálogo.
  if (session.role === "sub_user") return forbidden();

  return NextResponse.json({
    modulos: MODULE_ORDER.map((m) => ({
      module: m,
      label: MODULE_LABELS[m],
      permisos: PERMISSIONS.filter((p) => p.module === m),
    })),
  });
}
