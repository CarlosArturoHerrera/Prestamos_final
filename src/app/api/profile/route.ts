import { NextResponse } from "next/server";
import { getUserAndRole, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/profile — identidad de la sesión actual.
 *
 * Devuelve el rol, la organización (`adminId`) y los permisos efectivos para
 * que la interfaz pueda ocultar lo que el usuario no puede usar.
 *
 * Esto es CONVENIENCIA DE UI, no un control de seguridad: cada ruta API vuelve
 * a verificar la sesión por su cuenta y las policies RLS filtran las filas en
 * la base de datos. Ocultar un botón no protege nada; esto sólo evita mostrar
 * acciones que el backend rechazaría (§17).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  return NextResponse.json({
    userId: session.userId,
    role: session.role,
    isActive: session.isActive,
    adminId: session.adminId,
    permissions: session.permissions,
    email: session.email,
    username: session.username,
    fullName: session.fullName,
  });
}
