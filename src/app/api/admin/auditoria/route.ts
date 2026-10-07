import { NextResponse } from "next/server";
import { getUserAndRole, requireSuperAdmin, serverError } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/auditoria — registro de acciones administrativas (§28).
 *
 * Exclusivo del megaadministrador: es el rastro de quién tocó qué cuenta.
 * `audit_logs` es append-only (un trigger rechaza UPDATE y DELETE), así que
 * esta ruta sólo lee.
 *
 * No existe forma de que aquí aparezca una contraseña o un token: `auditLog()`
 * elimina esas claves del payload antes de escribirlo, y la tabla no tiene
 * ninguna columna donde pudieran caber.
 *
 * Filtros por query string: `accion`, `adminId`, `actorId`, `desde`, `hasta`.
 * Paginación por `page` / `pageSize`.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    200,
    Math.max(1, Number(searchParams.get("pageSize") || 50)),
  );
  const accion = searchParams.get("accion");
  const adminId = searchParams.get("adminId");
  const actorId = searchParams.get("actorId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const db = createSupabaseAdminClient();

    let q = db
      .from("audit_logs")
      .select(
        "id, actor_id, actor_role, actor_email, accion, entidad, entidad_id, admin_id, detalle, ip, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (accion) q = q.eq("accion", accion);
    if (adminId) q = q.eq("admin_id", adminId);
    if (actorId) q = q.eq("actor_id", actorId);
    if (desde) q = q.gte("created_at", `${desde}T00:00:00Z`);
    // `hasta` es inclusivo: se compara contra el final de ese día.
    if (hasta) q = q.lte("created_at", `${hasta}T23:59:59.999Z`);

    const { data, error, count } = await q.range(from, to);
    if (error) return serverError(error.message);

    // Nombres de los perfiles implicados, resueltos en una sola consulta en
    // lugar de una por fila. Una cuenta eliminada deja el id en NULL, asi que
    // el nombre puede faltar: la interfaz lo muestra como "—".
    const ids = new Set<string>();
    for (const f of data ?? []) {
      if (f.actor_id) ids.add(f.actor_id);
      if (f.admin_id) ids.add(f.admin_id);
    }

    const nombres = new Map<string, string>();
    if (ids.size > 0) {
      const { data: perfiles } = await db
        .from("profiles")
        .select("id, full_name, username, email")
        .in("id", [...ids]);

      for (const p of perfiles ?? []) {
        nombres.set(p.id, p.full_name ?? p.username ?? p.email ?? "—");
      }
    }

    const registros = (data ?? []).map((f) => ({
      ...f,
      actor_nombre: f.actor_id ? (nombres.get(f.actor_id) ?? null) : null,
      admin_nombre: f.admin_id ? (nombres.get(f.admin_id) ?? null) : null,
    }));

    // Catálogo de acciones presentes, para poblar el filtro sin inventarse
    // valores que nunca han ocurrido.
    const { data: acciones } = await db
      .from("audit_logs")
      .select("accion")
      .limit(1000);

    // Cuentas sobre las que se puede filtrar. Son todos los administradores,
    // no sólo los que ya tienen registros: así el filtro sirve también para
    // confirmar que sobre una cuenta NO se ha hecho nada.
    const { data: cuentas } = await db
      .from("profiles")
      .select("id, full_name, username, email")
      .eq("role", "admin")
      .order("created_at", { ascending: true });

    return NextResponse.json({
      registros,
      page,
      pageSize,
      total: count ?? 0,
      acciones: [...new Set((acciones ?? []).map((a) => a.accion))].sort(),
      cuentas: (cuentas ?? []).map((c) => ({
        id: c.id,
        nombre: c.full_name ?? c.username ?? c.email ?? "—",
      })),
    });
  } catch (err) {
    console.error("[admin/auditoria GET]", err);
    return serverError("Error al leer el registro de auditoría");
  }
}
