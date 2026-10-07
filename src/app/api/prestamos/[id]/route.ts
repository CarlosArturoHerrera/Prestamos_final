import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  forbidden,
  getUserAndRole,
  requireAdmin,
  requireTenant,
  soloOrganizacion,
  soloTitular,
  unauthorized,
} from "@/lib/api-auth";
import { sincronizarInteresesYCapitalizacionAuto } from "@/lib/prestamo-logic";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  const { data: p, error } = await supabase
    .from("prestamos")
    .select(
      `
      *,
      clientes (
        id, nombre, apellido, cedula, telefono,
        representantes ( id, nombre, apellido, telefono, email ),
        empresas ( id, nombre )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error || !p) {
    return NextResponse.json(
      { error: "Préstamo no encontrado" },
      { status: 404 },
    );
  }

  const merged = await sincronizarInteresesYCapitalizacionAuto(supabase, p);

  const { data: abonos } = await supabase
    .from("abonos")
    .select("*")
    .eq("prestamo_id", id)
    .order("fecha_abono", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: intereses } = await supabase
    .from("intereses_atrasados")
    .select("*")
    .eq("prestamo_id", id)
    .order("fecha_periodo", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: reganches } = await supabase
    .from("reganches")
    .select("*")
    .eq("prestamo_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    prestamo: { ...merged, clientes: p.clientes },
    abonos: abonos ?? [],
    intereses_atrasados: intereses ?? [],
    reganches: reganches ?? [],
  });
}

const putSchema = z.object({
  notas: z.string().max(5000).optional().nullable(),
  /** Porcentaje sobre el interés pagado que cobra el representante. */
  comisionRepresentante: z
    .union([z.coerce.number().min(0).max(100), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  estado: z.enum(["ACTIVO", "SALDADO", "MORA"]).optional(),
  capitalADebitar: z
    .union([
      z.string().regex(/^\d+(\.\d{1,4})?$/, "Monto inválido"),
      z.number(),
    ])
    .optional()
    .refine(
      (v) => v === undefined || Number(v) > 0,
      "Capital a debitar debe ser mayor que 0",
    ),
});

export async function PUT(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  const auth = requireTenant(session);
  if (auth instanceof NextResponse) return auth;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida");
  }

  if (parsed.data.estado && !requireAdmin(auth.role)) {
    return forbidden();
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.notas !== undefined)
    payload.notas = parsed.data.notas?.trim() || null;
  if (parsed.data.estado) payload.estado = parsed.data.estado;
  if (parsed.data.capitalADebitar !== undefined)
    payload.capital_a_debitar = String(parsed.data.capitalADebitar);
  // Se distingue "no vino en la petición" de "vino vacío": lo primero deja la
  // comisión como estaba, lo segundo la retira.
  if ("comisionRepresentante" in (body as Record<string, unknown>))
    payload.comision_representante = parsed.data.comisionRepresentante;

  if (Object.keys(payload).length === 0) {
    return badRequest("Nada que actualizar");
  }

  const { data, error } = await supabase
    .from("prestamos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

/**
 * Elimina un préstamo. Reservado a super_admin: además de este guard, la policy
 * RESTRICTIVE `prestamos_delete_super_admin_only` rechaza el DELETE en la propia
 * base de datos, de modo que el permiso no depende del frontend.
 *
 * Sólo se borra la fila del préstamo. Sus registros dependientes se resuelven
 * con las reglas de integridad ya definidas en el esquema (cascade en abonos,
 * reganches e intereses_atrasados; set null en gestion_cobranza). El cliente y
 * el resto de préstamos quedan intactos.
 */
export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  // CAMBIO DE TITULARIDAD DEL PRIVILEGIO.
  // Antes esta accion estaba reservada al megaadministrador. Con el modelo
  // corregido el megaadministrador ya no accede a la cartera, asi que borrar
  // prestamos pasa al ADMINISTRADOR TITULAR de la organizacion. Sigue fuera
  // del alcance de un subusuario, que es lo que la restriccion protegia.
  // La policy prestamos_delete_titular_only impone lo mismo en la base.
  const bloqueo = soloTitular(session);
  if (bloqueo) return bloqueo;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  // `select()` devuelve las filas afectadas: si viene vacío, o el préstamo no
  // existe o la policy bloqueó el borrado. En ambos casos no se borró nada.
  const { data, error } = await supabase
    .from("prestamos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "El préstamo no existe o no se pudo eliminar" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, id });
}
