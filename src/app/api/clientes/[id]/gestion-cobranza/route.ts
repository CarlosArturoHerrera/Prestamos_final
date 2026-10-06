import { NextResponse } from "next/server";
import {
  badRequest,
  ensureProfileRow,
  getUserAndRole,
  requireTenant,
  unauthorized,
} from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gestionCobranzaCreateSchema } from "@/lib/validations/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  // requireTenant devuelve la sesion ya validada, que hace falta mas abajo
  // para registrar quien crea el seguimiento.
  const auth = requireTenant(session);
  if (auth instanceof NextResponse) return auth;

  const { id: idParam } = await ctx.params;
  const clienteId = Number(idParam);
  if (!Number.isFinite(clienteId)) return badRequest("ID inválido");

  const { data: existe } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle();
  if (!existe) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("gestion_cobranza")
    .select(
      `
      *,
      prestamos ( id, estado, capital_pendiente )
    `,
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  // requireTenant devuelve la sesion ya validada, que hace falta mas abajo
  // para registrar quien crea el seguimiento.
  const auth = requireTenant(session);
  if (auth instanceof NextResponse) return auth;

  const { id: idParam } = await ctx.params;
  const clienteId = Number(idParam);
  if (!Number.isFinite(clienteId)) return badRequest("ID inválido");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = gestionCobranzaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida");
  }

  const {
    notas,
    promesaMonto,
    promesaFecha,
    proximaFechaContacto,
    resultado,
    prestamoId,
  } = parsed.data;

  const { data: clienteRow, error: eCli } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .single();
  if (eCli || !clienteRow) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  const prestamoIdFinal: number | null = prestamoId ?? null;
  if (prestamoIdFinal != null) {
    const { data: pr, error: ePr } = await supabase
      .from("prestamos")
      .select("id, cliente_id")
      .eq("id", prestamoIdFinal)
      .single();
    if (ePr || !pr || pr.cliente_id !== clienteId) {
      return badRequest("El préstamo no pertenece a este cliente");
    }
  }

  const ensuredProfile = await ensureProfileRow(
    supabase,
    auth.userId,
    auth.role,
  );
  if (!ensuredProfile.ok) {
    console.error(
      "[gestion-cobranza][cliente] No se pudo asegurar profile antes del insert",
      {
        userId: auth.userId,
        clienteId,
        reason: ensuredProfile.message,
        code: ensuredProfile.code ?? null,
      },
    );
    return NextResponse.json(
      {
        error:
          "No se pudo preparar el perfil del usuario autenticado para registrar el seguimiento. Contacta al administrador.",
      },
      { status: 500 },
    );
  }
  const insert = {
    cliente_id: clienteId,
    prestamo_id: prestamoIdFinal,
    notas: (notas ?? "").trim(),
    promesa_monto: promesaMonto != null ? Number(promesaMonto) : null,
    promesa_fecha: promesaFecha ?? null,
    proxima_fecha_contacto: proximaFechaContacto ?? null,
    resultado,
    creado_por: auth.userId,
  };

  console.log(
    "auth.userId",
    auth.userId,
    "creado_por final",
    insert.creado_por,
  );

  const { data: row, error } = await supabase
    .from("gestion_cobranza")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row, { status: 201 });
}
