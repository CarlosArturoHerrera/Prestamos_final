import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  forbidden,
  getUserAndRole,
  notFound,
  requireSuperAdmin,
  serverError,
} from "@/lib/api-auth";
import { auditLog, clientIp } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enviarResetPassword } from "@/lib/user-admin";
import { administradorUpdateSchema } from "@/lib/validations/usuarios";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * /api/admin/users/[id] — ficha de un ADMINISTRADOR (§8, §11, §12, §24).
 *
 * Reservada al megaadministrador. Tres invariantes que se mantienen aquí:
 *   • Nunca se puede deshabilitar ni eliminar una cuenta super_admin.
 *   • Nunca se puede actuar sobre la propia cuenta de forma destructiva.
 *   • El rol no es modificable por esta ruta: no figura en el esquema de
 *     validación, así que no hay camino desde el cuerpo de la petición (§29).
 */

const accionSchema = z.object({
  action: z.enum(["reset_password"]).optional(),
});

// ── GET /api/admin/users/[id] ────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createSupabaseAdminClient();

    const { data: profile, error } = await db
      .from("profiles")
      .select(
        "id, role, admin_id, full_name, first_name, last_name, username, cedula, telefono, email, is_active, created_at, updated_at",
      )
      .eq("id", targetId)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!profile) return notFound("Administrador no encontrado");

    const [{ data: mantenimiento }, { data: pagos }, { count: subusuarios }] =
      await Promise.all([
        db
          .from("admin_maintenance")
          .select("*")
          .eq("admin_id", targetId)
          .maybeSingle(),
        db
          .from("admin_maintenance_payments")
          .select("id, monto, fecha_pago, periodo, metodo, notas, created_at")
          .eq("admin_id", targetId)
          .order("fecha_pago", { ascending: false })
          .limit(24),
        db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "sub_user")
          .eq("admin_id", targetId),
      ]);

    return NextResponse.json({
      user: profile,
      mantenimiento: mantenimiento ?? null,
      pagos: pagos ?? [],
      subusuarios: subusuarios ?? 0,
    });
  } catch (err) {
    console.error("[admin/users GET id]", err);
    return serverError("Error al obtener el administrador");
  }
}

// ── PATCH /api/admin/users/[id] ──────────────────────────────────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Cuerpo de solicitud inválido");
  }

  const db = createSupabaseAdminClient();
  const ip = clientIp(req);

  const { data: target } = await db
    .from("profiles")
    .select("id, role, email, username, is_active")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) return notFound("Administrador no encontrado");

  // ── Restablecimiento de contraseña por correo (§24) ──
  // Se genera un enlace de un solo uso con expiración y se entrega por Resend.
  // NUNCA se envía la contraseña actual ni ninguna en texto plano.
  const accion = accionSchema.safeParse(body);
  if (accion.success && accion.data.action === "reset_password") {
    if (!target.email)
      return badRequest("Email no encontrado para este usuario");

    const envio = await enviarResetPassword(target.email);
    if (!envio.ok) {
      return NextResponse.json(
        { error: envio.message },
        { status: envio.status },
      );
    }

    await auditLog(session, {
      action: "admin.reset_password",
      entity: "profile",
      entityId: targetId,
      adminId: targetId,
      detail: { username: target.username },
      ip,
    });

    return NextResponse.json({ message: "Email de recuperación enviado" });
  }

  const parsed = administradorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;

  // ── Deshabilitar: §11. Es una baja LÓGICA ──
  // No se borra ni un cliente, préstamo, pago, registro, subusuario ni
  // historial. Al poner is_active=false, current_tenant_id() pasa a devolver
  // NULL tanto para el administrador como para sus subusuarios, así que todos
  // pierden el acceso de golpe y los datos quedan intactos.
  if (d.isActive === false) {
    if (target.role === "super_admin") return forbidden();
    if (targetId === auth.userId) {
      return badRequest("No puedes desactivar tu propia cuenta");
    }
  }

  const updates: Record<string, unknown> = {};
  if (d.nombre !== undefined) updates.first_name = d.nombre;
  if (d.apellido !== undefined) updates.last_name = d.apellido;
  if (d.cedula !== undefined) updates.cedula = d.cedula;
  if (d.telefono !== undefined) updates.telefono = d.telefono;
  if (d.email !== undefined) updates.email = d.email;
  if (d.username !== undefined) updates.username = d.username;
  if (d.isActive !== undefined) updates.is_active = d.isActive;

  if (Object.keys(updates).length === 0) {
    return badRequest("No hay cambios que aplicar");
  }

  try {
    const { error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", targetId);
    if (error) {
      if (error.message.includes("uq_profiles_username_lower")) {
        return badRequest("Ese nombre de usuario ya está en uso");
      }
      return serverError(error.message);
    }

    // El correo es la credencial de acceso: si cambia en profiles pero no en
    // auth.users, el administrador dejaría de poder iniciar sesión.
    if (d.email) {
      const { error: authError } = await db.auth.admin.updateUserById(
        targetId,
        {
          email: d.email,
        },
      );
      if (authError) {
        console.error(
          "[admin/users PATCH] sincronización de email",
          authError.message,
        );
      }
    }

    await auditLog(session, {
      action:
        d.isActive === false
          ? "admin.deshabilitar"
          : d.isActive === true
            ? "admin.reactivar"
            : "admin.editar",
      entity: "profile",
      entityId: targetId,
      adminId: targetId,
      detail: { campos: Object.keys(updates), username: target.username },
      ip,
    });

    return NextResponse.json({ message: "Administrador actualizado" });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return serverError("Error al actualizar el administrador");
  }
}

// ── DELETE /api/admin/users/[id] ─────────────────────────────────────────────
// Borrado DEFINITIVO de la cuenta. Para retirar el acceso conservando todo,
// usa PATCH con isActive:false (§11), que es lo que debería hacerse casi
// siempre: aquí la FK admin_id de las tablas de negocio es ON DELETE RESTRICT,
// así que un administrador con cartera NO puede eliminarse. Es intencionado:
// evita destruir préstamos e historial financiero por accidente (§7, §27).
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  if (targetId === auth.userId) {
    return badRequest("No puedes eliminar tu propia cuenta");
  }

  try {
    const db = createSupabaseAdminClient();

    const { data: target } = await db
      .from("profiles")
      .select("role, username")
      .eq("id", targetId)
      .maybeSingle();

    if (!target) return notFound("Administrador no encontrado");
    if (target.role === "super_admin") return forbidden();

    // Comprobación previa explícita: da un mensaje claro en vez de dejar que
    // aflore una violación de clave foránea.
    const { count: clientes } = await db
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", targetId);

    if ((clientes ?? 0) > 0) {
      return badRequest(
        `Este administrador tiene ${clientes} cliente(s) y su cartera asociada. ` +
          "No se puede eliminar sin destruir ese historial: deshabilítalo en su lugar.",
      );
    }

    const { error } = await db.auth.admin.deleteUser(targetId);
    if (error) return serverError(error.message);

    await auditLog(session, {
      action: "admin.eliminar",
      entity: "profile",
      entityId: targetId,
      adminId: targetId,
      detail: { username: target.username },
      ip: clientIp(req),
    });

    return NextResponse.json({ message: "Administrador eliminado" });
  } catch (err) {
    console.error("[admin/users DELETE]", err);
    return serverError("Error al eliminar el administrador");
  }
}
