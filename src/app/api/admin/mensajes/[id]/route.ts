import { NextResponse } from "next/server";
import {
  badRequest,
  getUserAndRole,
  notFound,
  requireSuperAdmin,
  serverError,
} from "@/lib/api-auth";
import { auditLog, clientIp } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mensajeUpdateSchema } from "@/lib/validations/usuarios";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH / DELETE de un mensaje. Sólo el megaadministrador (§23). */

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = mensajeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;
  const db = createSupabaseAdminClient();

  const { data: actual } = await db
    .from("admin_messages")
    .select("id, admin_id")
    .eq("id", id)
    .maybeSingle();

  if (!actual) return notFound("Mensaje no encontrado");

  const updates: Record<string, unknown> = {};
  if (d.titulo !== undefined) updates.titulo = d.titulo;
  if (d.cuerpo !== undefined) updates.cuerpo = d.cuerpo;
  if (d.tipo !== undefined) updates.tipo = d.tipo;
  if (d.expiraEn !== undefined) updates.expira_en = d.expiraEn;

  if (Object.keys(updates).length === 0) {
    return badRequest("No hay cambios que aplicar");
  }

  const { error } = await db
    .from("admin_messages")
    .update(updates)
    .eq("id", id);
  if (error) return serverError(error.message);

  await auditLog(session, {
    action: "admin.mensaje_editar",
    entity: "admin_message",
    entityId: id,
    adminId: actual.admin_id,
    detail: { campos: Object.keys(updates) },
    ip: clientIp(req),
  });

  return NextResponse.json({ message: "Mensaje actualizado" });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  const db = createSupabaseAdminClient();

  const { data: actual } = await db
    .from("admin_messages")
    .select("id, admin_id")
    .eq("id", id)
    .maybeSingle();

  if (!actual) return notFound("Mensaje no encontrado");

  const { error } = await db.from("admin_messages").delete().eq("id", id);
  if (error) return serverError(error.message);

  await auditLog(session, {
    action: "admin.mensaje_eliminar",
    entity: "admin_message",
    entityId: id,
    adminId: actual.admin_id,
    ip: clientIp(req),
  });

  return NextResponse.json({ message: "Mensaje eliminado" });
}
