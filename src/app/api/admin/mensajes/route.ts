import { NextResponse } from "next/server";
import {
  badRequest,
  getUserAndRole,
  requireSuperAdmin,
  serverError,
} from "@/lib/api-auth";
import { auditLog, clientIp } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mensajeCreateSchema } from "@/lib/validations/usuarios";

/**
 * /api/admin/mensajes — mensajes personalizados del megaadministrador (§23).
 *
 *   GET  ?adminId=…  → historial de mensajes (todos, o los de un administrador)
 *   POST             → enviar un mensaje nuevo
 *
 * El destinatario puede leerlos y marcarlos como leídos, pero no editar su
 * contenido: eso lo impide el trigger proteger_contenido_mensaje en la base de
 * datos, no sólo la interfaz.
 */

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  const adminId = new URL(req.url).searchParams.get("adminId");

  const db = createSupabaseAdminClient();
  let q = db
    .from("admin_messages")
    .select(
      "id, admin_id, titulo, cuerpo, tipo, leido_en, expira_en, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (adminId) q = q.eq("admin_id", adminId);

  const { data, error } = await q;
  if (error) return serverError(error.message);

  return NextResponse.json({ mensajes: data ?? [] });
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
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

  const parsed = mensajeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;
  const db = createSupabaseAdminClient();

  // El destinatario debe ser un administrador real; si no, el mensaje nunca
  // se mostraría y quedaría huérfano.
  const { data: destinatario } = await db
    .from("profiles")
    .select("id, username")
    .eq("id", d.adminId)
    .eq("role", "admin")
    .maybeSingle();

  if (!destinatario) return badRequest("El administrador indicado no existe");

  const { data: creado, error } = await db
    .from("admin_messages")
    .insert({
      admin_id: d.adminId,
      autor_id: auth.userId,
      titulo: d.titulo,
      cuerpo: d.cuerpo,
      tipo: d.tipo ?? "INFO",
      expira_en: d.expiraEn,
    })
    .select("id")
    .single();

  if (error) return serverError(error.message);

  await auditLog(session, {
    action: "admin.mensaje_enviar",
    entity: "admin_message",
    entityId: String(creado.id),
    adminId: d.adminId,
    // Se registra el título, no el cuerpo: basta para auditar sin duplicar
    // contenido que ya vive en admin_messages.
    detail: { titulo: d.titulo, tipo: d.tipo ?? "INFO" },
    ip: clientIp(req),
  });

  return NextResponse.json(
    { message: "Mensaje enviado", id: creado.id },
    { status: 201 },
  );
}
