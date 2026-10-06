import { NextResponse } from "next/server";
import {
  badRequest,
  forbidden,
  getUserAndRole,
  serverError,
  unauthorized,
} from "@/lib/api-auth";
import { auditLog, clientIp } from "@/lib/audit";
import {
  DEFAULT_SUBUSER_PERMISSIONS,
  type PermissionCode,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { crearUsuario, reemplazarPermisos } from "@/lib/user-admin";
import { subusuarioCreateSchema } from "@/lib/validations/usuarios";

/**
 * /api/subusuarios — SUBUSUARIOS de la organización del solicitante (§13).
 *
 * Quién puede entrar:
 *   admin       → gestiona exclusivamente SUS subusuarios.
 *   super_admin → puede gestionar los de cualquier administrador indicando
 *                 ?adminId=… (§2: "Gestionar Subusuarios de cada Administrador").
 *   sub_user    → sin acceso. Un subusuario no crea subusuarios.
 *
 * La organización propietaria NUNCA se toma del cuerpo de la petición: sale de
 * la sesión (§15, §17). El único caso en que se acepta un adminId externo es el
 * del megaadministrador, cuya autoridad global ya se ha verificado.
 */

/** Resuelve sobre qué organización opera el solicitante, o un error HTTP. */
async function resolverOrganizacion(
  request: Request,
  session: Awaited<ReturnType<typeof getUserAndRole>>,
): Promise<{ adminId: string } | NextResponse> {
  if (!session) return unauthorized();
  if (!session.isActive) return forbidden();

  if (session.role === "super_admin") {
    const solicitado = new URL(request.url).searchParams.get("adminId");
    if (!solicitado) {
      return badRequest(
        "Indica ?adminId= para consultar los subusuarios de un administrador",
      );
    }
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("profiles")
      .select("id")
      .eq("id", solicitado)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) return badRequest("El administrador indicado no existe");
    return { adminId: data.id };
  }

  // admin → su propia organización. sub_user → adminId existe pero no tiene
  // autoridad para gestionar usuarios, así que se corta aquí.
  if (session.role !== "admin" || !session.adminId) return forbidden();
  return { adminId: session.adminId };
}

// ── GET /api/subusuarios ─────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  const org = await resolverOrganizacion(request, session);
  if (org instanceof NextResponse) return org;

  const db = createSupabaseAdminClient();

  const { data: perfiles, error } = await db
    .from("profiles")
    .select(
      "id, username, email, first_name, last_name, full_name, telefono, cedula, is_active, created_at, updated_at",
    )
    .eq("role", "sub_user")
    .eq("admin_id", org.adminId)
    .order("created_at", { ascending: true });

  if (error) return serverError(error.message);

  const ids = (perfiles ?? []).map((p) => p.id);
  const permisosPorUsuario = new Map<string, PermissionCode[]>();

  if (ids.length > 0) {
    const { data: permisos } = await db
      .from("user_permissions")
      .select("user_id, permission_code")
      .in("user_id", ids);

    for (const fila of permisos ?? []) {
      const lista = permisosPorUsuario.get(fila.user_id) ?? [];
      lista.push(fila.permission_code as PermissionCode);
      permisosPorUsuario.set(fila.user_id, lista);
    }
  }

  // Nunca se devuelve nada relacionado con la contraseña (§7).
  const subusuarios = (perfiles ?? []).map((p) => ({
    ...p,
    permisos: permisosPorUsuario.get(p.id) ?? [],
  }));

  return NextResponse.json({ adminId: org.adminId, subusuarios });
}

// ── POST /api/subusuarios ────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  const org = await resolverOrganizacion(request, session);
  if (org instanceof NextResponse) return org;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = subusuarioCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;

  const resultado = await crearUsuario({
    email: d.email,
    password: d.password,
    role: "sub_user",
    // Del servidor, no del cuerpo: un subusuario jamás elige su organización.
    adminId: org.adminId,
    nombre: d.nombre,
    apellido: d.apellido,
    username: d.username,
    telefono: d.telefono,
    cedula: d.cedula,
  });

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.message },
      { status: resultado.status },
    );
  }

  const permisos = (d.permisos ?? [
    ...DEFAULT_SUBUSER_PERMISSIONS,
  ]) as PermissionCode[];
  const db = createSupabaseAdminClient();
  const permOk = await reemplazarPermisos(
    db,
    resultado.userId,
    permisos,
    session?.userId ?? org.adminId,
  );

  if (!permOk.ok) {
    console.error("[subusuarios POST] permisos", permOk.message);
    // El usuario queda creado sin permisos: es el estado seguro (no puede
    // hacer nada) y el administrador puede corregirlo desde la ficha.
    return NextResponse.json(
      {
        message:
          "Subusuario creado, pero no se pudieron guardar los permisos. Edítalos desde su ficha.",
        userId: resultado.userId,
      },
      { status: 201 },
    );
  }

  await auditLog(session, {
    action: "subusuario.crear",
    entity: "profile",
    entityId: resultado.userId,
    adminId: org.adminId,
    // sanitizeDetail() elimina cualquier clave de contraseña por si acaso.
    detail: { username: d.username, email: d.email, permisos },
    ip: clientIp(request),
  });

  return NextResponse.json(
    { message: "Subusuario creado correctamente", userId: resultado.userId },
    { status: 201 },
  );
}
