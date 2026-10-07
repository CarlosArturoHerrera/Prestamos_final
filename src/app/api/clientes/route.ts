import { NextResponse } from "next/server";
import {
  badRequest,
  getUserAndRole,
  soloOrganizacion,
  unauthorized,
} from "@/lib/api-auth";
import { urlsFirmadas } from "@/lib/cliente-foto";
import { normalizeSearchTerm } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clienteCreateSchema } from "@/lib/validations/schemas";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    200,
    Math.max(1, Number(searchParams.get("pageSize") || 20)),
  );
  const search = (
    searchParams.get("search") ||
    searchParams.get("q") ||
    ""
  ).trim();
  const representanteId = searchParams.get("representanteId");
  const empresaId = searchParams.get("empresaId");
  const estadoValidacion = searchParams.get("estadoValidacion");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("clientes")
    .select(
      `
      *,
      empresas ( id, nombre ),
      representantes ( id, nombre, apellido )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (representanteId) {
    q = q.eq("representante_id", Number(representanteId));
  }
  if (empresaId) {
    q = q.eq("empresa_id", Number(empresaId));
  }
  if (
    estadoValidacion &&
    ["VALIDADO", "PENDIENTE_VALIDAR"].includes(estadoValidacion)
  ) {
    q = q.eq("estado_validacion", estadoValidacion);
  }

  if (search) {
    const s = `%${search}%`;
    const sn = `%${normalizeSearchTerm(search)}%`;
    // El apodo se suma a los campos que ya se buscaban, no los reemplaza.
    // `.or()` se combina con los filtros de arriba mediante AND, así que
    // buscar "moreno" dentro de un representante concreto sigue funcionando.
    q = q.or(
      `nombre.ilike.${s},apellido.ilike.${s},apodo.ilike.${s},cedula.ilike.${sn},telefono.ilike.${sn}`,
    );
  }

  const { data, error, count } = await q.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Las fotos se firman en lote: una página de 20 clientes sería 20 peticiones
  // a Storage si se hiciera de una en una.
  const firmas = await urlsFirmadas(
    supabase,
    (data ?? []).map((c) => c.foto_path as string | null),
  );

  return NextResponse.json({
    data: (data ?? []).map((c) => ({
      ...c,
      foto_url: c.foto_path ? (firmas.get(c.foto_path) ?? null) : null,
    })),
    page,
    pageSize,
    total: count ?? 0,
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  // El megaadministrador no accede a datos operativos (403);
  // el resto queda acotado a su propia organizacion.
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = clienteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida");
  }

  const payload = {
    nombre: parsed.data.nombre.trim(),
    apellido: parsed.data.apellido.trim(),
    apodo: parsed.data.apodo,
    cedula: parsed.data.cedula.trim(),
    ubicacion: parsed.data.ubicacion.trim(),
    telefono: parsed.data.telefono.trim(),
    estado_validacion: parsed.data.estadoValidacion ?? "VALIDADO",
    representante_id: parsed.data.representanteId,
    empresa_id: parsed.data.empresaId,
  };

  const { data, error } = await supabase
    .from("clientes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("Ya existe un cliente con esa cédula");
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
