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
import { crearUsuario } from "@/lib/user-admin";
import { administradorCreateSchema } from "@/lib/validations/usuarios";

/**
 * /api/admin/users — ADMINISTRADORES, gestionados por el megaadministrador (§8).
 *
 * La ruta ya existía; se amplía con los campos de la jerarquía (nombre,
 * apellido, cédula, teléfono, usuario), el resumen de mantenimiento y el
 * recuento de subusuarios, además de registro de auditoría.
 *
 * Nunca devuelve nada relacionado con contraseñas (§7).
 */

type FilaMantenimiento = {
  admin_id: string;
  estado: string;
  dia_pago: number | null;
  monto: number | null;
  ultimo_pago: string | null;
  proximo_pago: string | null;
};

// ── GET /api/admin/users ─────────────────────────────────────────────────────
// Lista de administradores con su mantenimiento y su número de subusuarios.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createSupabaseAdminClient();

    // Mismo motivo que en la pagina: el estado debe reflejar la realidad de
    // hoy, no el ultimo recalculo que alguien provocase por casualidad.
    await db.rpc("refrescar_estados_mantenimiento");

    const [{ data: profiles, error: profilesError }, { data: authData }] =
      await Promise.all([
        db
          .from("profiles")
          .select(
            "id, role, admin_id, full_name, first_name, last_name, username, cedula, telefono, email, is_active, created_at, updated_at",
          )
          .order("created_at", { ascending: true }),
        db.auth.admin.listUsers({ perPage: 1000 }),
      ]);

    if (profilesError) return serverError(profilesError.message);

    const todos = profiles ?? [];
    // La pantalla gestiona administradores y megaadministradores; los
    // subusuarios se consultan por organización en /api/subusuarios.
    const administradores = todos.filter((p) => p.role !== "sub_user");

    const { data: mantenimiento } = await db
      .from("admin_maintenance")
      .select("admin_id, estado, dia_pago, monto, ultimo_pago, proximo_pago");

    const mapaMant = new Map<string, FilaMantenimiento>(
      (mantenimiento ?? []).map((m) => [m.admin_id, m as FilaMantenimiento]),
    );

    // Subusuarios por administrador, contados en memoria para no hacer una
    // consulta por fila.
    const subusuariosPorAdmin = new Map<string, number>();
    for (const p of todos) {
      if (p.role === "sub_user" && p.admin_id) {
        subusuariosPorAdmin.set(
          p.admin_id,
          (subusuariosPorAdmin.get(p.admin_id) ?? 0) + 1,
        );
      }
    }

    const ultimoAcceso = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
    );

    const users = administradores.map((p) => ({
      ...p,
      last_sign_in_at: ultimoAcceso.get(p.id) ?? null,
      mantenimiento: mapaMant.get(p.id) ?? null,
      subusuarios: subusuariosPorAdmin.get(p.id) ?? 0,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return serverError("Error al obtener los administradores");
  }
}

// ── POST /api/admin/users ────────────────────────────────────────────────────
// Crea un ADMINISTRADOR (§10). El rol se fija aquí a 'admin': nunca se acepta
// un rol enviado por el cliente, así que no hay forma de crear otro
// megaadministrador desde la API (§29).
export async function POST(req: Request) {
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

  const parsed = administradorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;

  const resultado = await crearUsuario({
    email: d.email,
    password: d.password,
    role: "admin",
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

  // Ficha de mantenimiento en blanco, para que el megaadministrador sólo tenga
  // que fijar el día de pago desde la interfaz (§21).
  const db = createSupabaseAdminClient();
  const { error: mantError } = await db
    .from("admin_maintenance")
    .insert({ admin_id: resultado.userId });
  if (mantError && mantError.code !== "23505") {
    console.error("[admin/users POST] mantenimiento", mantError.message);
  }

  await auditLog(session, {
    action: "admin.crear",
    entity: "profile",
    entityId: resultado.userId,
    adminId: resultado.userId,
    detail: {
      username: d.username,
      email: d.email,
      nombre: d.nombre,
      apellido: d.apellido,
    },
    ip: clientIp(req),
  });

  return NextResponse.json(
    { message: "Administrador creado correctamente", userId: resultado.userId },
    { status: 201 },
  );
}
