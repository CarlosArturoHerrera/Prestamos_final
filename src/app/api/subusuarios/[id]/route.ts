import { NextResponse } from "next/server";
import {
  badRequest,
  forbidden,
  getUserAndRole,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api-auth";
import { auditLog, clientIp } from "@/lib/audit";
import type { PermissionCode } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enviarResetPassword, reemplazarPermisos } from "@/lib/user-admin";
import { subusuarioUpdateSchema } from "@/lib/validations/usuarios";

type Ctx = { params: Promise<{ id: string }> };

/**
 * /api/subusuarios/[id] — ficha de un subusuario.
 *
 * Protección IDOR (§18): no basta con que el solicitante sea administrador.
 * Antes de cualquier operación se comprueba que el subusuario objetivo
 * pertenece REALMENTE a su organización; si no, se responde 404 —no 403— para
 * no confirmar siquiera que ese id existe en otra organización.
 */
async function cargarObjetivo(
  session: Awaited<ReturnType<typeof getUserAndRole>>,
  targetId: string,
): Promise<
  | {
      target: {
        id: string;
        admin_id: string;
        email: string | null;
        username: string | null;
      };
    }
  | NextResponse
> {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();
  // Un subusuario nunca administra a otros subusuarios.
  if (session.role === "sub_user") return forbidden();

  const db = createSupabaseAdminClient();
  const { data: target, error } = await db
    .from("profiles")
    .select("id, admin_id, email, username, role")
    .eq("id", targetId)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!target || target.role !== "sub_user")
    return notFound("Subusuario no encontrado");

  // El megaadministrador llega a cualquier organización; el administrador,
  // sólo a la suya.
  if (session.role !== "super_admin" && target.admin_id !== session.adminId) {
    return notFound("Subusuario no encontrado");
  }

  return {
    target: {
      id: target.id,
      admin_id: target.admin_id as string,
      email: target.email,
      username: target.username,
    },
  };
}

// ── GET /api/subusuarios/[id] ────────────────────────────────────────────────
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  const res = await cargarObjetivo(session, id);
  if (res instanceof NextResponse) return res;

  const db = createSupabaseAdminClient();
  const { data: perfil, error } = await db
    .from("profiles")
    .select(
      "id, username, email, first_name, last_name, full_name, telefono, cedula, is_active, admin_id, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error) return serverError(error.message);

  const { data: permisos } = await db
    .from("user_permissions")
    .select("permission_code")
    .eq("user_id", id);

  return NextResponse.json({
    subusuario: {
      ...perfil,
      permisos: (permisos ?? []).map(
        (p) => p.permission_code as PermissionCode,
      ),
    },
  });
}

// ── PATCH /api/subusuarios/[id] ──────────────────────────────────────────────
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  const res = await cargarObjetivo(session, id);
  if (res instanceof NextResponse) return res;
  const { target } = res;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = subusuarioUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;
  const db = createSupabaseAdminClient();
  const ip = clientIp(request);

  // ── Restablecimiento de contraseña por correo (§24) ──
  // Nunca se devuelve ni se registra la contraseña ni el enlace generado.
  if (d.action === "reset_password") {
    if (!target.email) {
      return badRequest("Este subusuario no tiene correo registrado");
    }
    const envio = await enviarResetPassword(target.email);
    if (!envio.ok) {
      return NextResponse.json(
        { error: envio.message },
        { status: envio.status },
      );
    }
    await auditLog(session, {
      action: "subusuario.reset_password",
      entity: "profile",
      entityId: id,
      adminId: target.admin_id,
      detail: { username: target.username },
      ip,
    });
    return NextResponse.json({ message: "Correo de restablecimiento enviado" });
  }

  // ── Datos del perfil ──
  // `role` y `admin_id` no se tocan JAMÁS aquí: no están en el esquema de
  // validación, así que no hay forma de llegar a ellos desde el cuerpo (§29).
  const updates: Record<string, unknown> = {};
  if (d.nombre !== undefined) updates.first_name = d.nombre;
  if (d.apellido !== undefined) updates.last_name = d.apellido;
  if (d.cedula !== undefined) updates.cedula = d.cedula;
  if (d.telefono !== undefined) updates.telefono = d.telefono;
  if (d.email !== undefined) updates.email = d.email;
  if (d.username !== undefined) updates.username = d.username;
  if (d.isActive !== undefined) updates.is_active = d.isActive;

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from("profiles").update(updates).eq("id", id);
    if (error) {
      if (error.message.includes("uq_profiles_username_lower")) {
        return badRequest("Ese nombre de usuario ya está en uso");
      }
      return serverError(error.message);
    }

    // El correo es la credencial de acceso: debe quedar sincronizado en
    // auth.users o el subusuario dejaría de poder iniciar sesión.
    if (d.email) {
      const { error: authErr } = await db.auth.admin.updateUserById(id, {
        email: d.email,
      });
      if (authErr) {
        console.error(
          "[subusuarios PATCH] sincronización de email",
          authErr.message,
        );
      }
    }
  }

  // ── Permisos (§14) ──
  if (d.permisos !== undefined) {
    const permOk = await reemplazarPermisos(
      db,
      id,
      d.permisos as PermissionCode[],
      session?.userId ?? target.admin_id,
    );
    if (!permOk.ok) return serverError(permOk.message);

    await auditLog(session, {
      action: "subusuario.permisos",
      entity: "profile",
      entityId: id,
      adminId: target.admin_id,
      detail: { permisos: d.permisos },
      ip,
    });
  }

  if (d.isActive !== undefined) {
    await auditLog(session, {
      action: d.isActive ? "subusuario.reactivar" : "subusuario.deshabilitar",
      entity: "profile",
      entityId: id,
      adminId: target.admin_id,
      detail: { username: target.username },
      ip,
    });
  } else if (Object.keys(updates).length > 0) {
    await auditLog(session, {
      action: "subusuario.editar",
      entity: "profile",
      entityId: id,
      adminId: target.admin_id,
      detail: { campos: Object.keys(updates) },
      ip,
    });
  }

  return NextResponse.json({ message: "Subusuario actualizado" });
}

// ── DELETE /api/subusuarios/[id] ─────────────────────────────────────────────
// Borra la CUENTA del subusuario. No borra ningún dato de cartera: los
// clientes, préstamos y abonos pertenecen a la organización, no a la persona
// que los registró (§11, §27).
export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  const res = await cargarObjetivo(session, id);
  if (res instanceof NextResponse) return res;
  const { target } = res;

  const db = createSupabaseAdminClient();

  // Eliminar de auth.users arrastra la fila de profiles por ON DELETE CASCADE,
  // y con ella sus user_permissions.
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return serverError(error.message);

  await auditLog(session, {
    action: "subusuario.eliminar",
    entity: "profile",
    entityId: id,
    adminId: target.admin_id,
    detail: { username: target.username },
    ip: clientIp(request),
  });

  return NextResponse.json({ message: "Subusuario eliminado" });
}
