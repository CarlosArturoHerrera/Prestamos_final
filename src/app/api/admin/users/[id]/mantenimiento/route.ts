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
import {
  mantenimientoPagoSchema,
  mantenimientoUpdateSchema,
} from "@/lib/validations/usuarios";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * /api/admin/users/[id]/mantenimiento — mantenimiento mensual de un
 * administrador (§21). Reservado al megaadministrador.
 *
 *   GET   → ficha + historial de pagos
 *   PATCH → configurar estado, día de pago, monto, próximo pago, notas
 *   POST  → registrar un pago (avanza automáticamente el próximo vencimiento)
 *
 * Esto es administración de la PLATAFORMA, no cartera. No comparte nada con
 * abonos, intereses ni ningún cálculo financiero de los préstamos (§30).
 */

async function existeAdministrador(id: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  const db = createSupabaseAdminClient();

  // Recalcula el estado antes de devolverlo, para que un vencimiento ya
  // pasado se muestre como VENCIDO sin esperar a un cron.
  await db.rpc("refrescar_estado_mantenimiento", { p_admin_id: id });

  const [{ data: mantenimiento }, { data: pagos }] = await Promise.all([
    db.from("admin_maintenance").select("*").eq("admin_id", id).maybeSingle(),
    db
      .from("admin_maintenance_payments")
      .select("id, monto, fecha_pago, periodo, metodo, notas, created_at")
      .eq("admin_id", id)
      .order("fecha_pago", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    mantenimiento: mantenimiento ?? null,
    pagos: pagos ?? [],
  });
}

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  if (!(await existeAdministrador(id))) {
    return notFound("Administrador no encontrado");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = mantenimientoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;
  const db = createSupabaseAdminClient();

  const fila: Record<string, unknown> = { admin_id: id };

  // "AUTO" significa "que lo calcule el servidor". Se guarda PENDIENTE como
  // base neutra y despues se recalcula. El paso por PENDIENTE no es cosmetico:
  // refrescar_estado_mantenimiento() respeta EXENTO y sale sin tocar nada, asi
  // que sin esto no habria forma de quitarle la exencion a un administrador.
  if (d.estado !== undefined) {
    fila.estado = d.estado === "AUTO" ? "PENDIENTE" : d.estado;
  }
  if (d.diaPago !== undefined) fila.dia_pago = d.diaPago;
  if (d.monto !== undefined) fila.monto = d.monto;
  if (d.notas !== undefined) fila.notas = d.notas;
  if (d.proximoPago !== undefined) fila.proximo_pago = d.proximoPago;

  // Si se fija el día de pago y no se indica próximo vencimiento, se calcula.
  if (d.diaPago != null && d.proximoPago === undefined) {
    const { data: calculado } = await db.rpc("calcular_proximo_pago", {
      p_dia: d.diaPago,
      p_desde: new Date().toISOString().slice(0, 10),
    });
    if (calculado) fila.proximo_pago = calculado;
  }

  const { error } = await db
    .from("admin_maintenance")
    .upsert(fila, { onConflict: "admin_id" });

  if (error) return serverError(error.message);

  // Un estado explícito manda. Si no se indicó, o se pidió "AUTO", se deduce
  // de las fechas y de si hay algún pago registrado.
  if (d.estado === undefined || d.estado === "AUTO") {
    await db.rpc("refrescar_estado_mantenimiento", { p_admin_id: id });
  }

  const { data: actualizado } = await db
    .from("admin_maintenance")
    .select("*")
    .eq("admin_id", id)
    .maybeSingle();

  await auditLog(session, {
    action: "admin.mantenimiento_configurar",
    entity: "admin_maintenance",
    entityId: id,
    adminId: id,
    detail: { campos: Object.keys(fila).filter((k) => k !== "admin_id") },
    ip: clientIp(req),
  });

  return NextResponse.json({
    message: "Mantenimiento actualizado",
    mantenimiento: actualizado,
  });
}

// ── POST — registrar un pago ─────────────────────────────────────────────────
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  if (!(await existeAdministrador(id))) {
    return notFound("Administrador no encontrado");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = mantenimientoPagoSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const d = parsed.data;
  const db = createSupabaseAdminClient();

  // registrar_pago_mantenimiento() añade el pago al historial y avanza
  // proximo_pago en una sola transacción, para que no puedan quedar
  // desincronizados.
  const { data, error } = await db.rpc("registrar_pago_mantenimiento", {
    p_admin_id: id,
    p_monto: d.monto,
    p_fecha: d.fechaPago ?? new Date().toISOString().slice(0, 10),
    p_metodo: d.metodo ?? null,
    p_notas: d.notas ?? null,
  });

  if (error) return serverError(error.message);

  await auditLog(session, {
    action: "admin.mantenimiento_pago",
    entity: "admin_maintenance_payments",
    entityId: id,
    adminId: id,
    detail: {
      monto: d.monto,
      fecha: d.fechaPago ?? null,
      metodo: d.metodo ?? null,
    },
    ip: clientIp(req),
  });

  return NextResponse.json(
    { message: "Pago registrado", mantenimiento: data },
    { status: 201 },
  );
}
