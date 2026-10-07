import { NextResponse } from "next/server";
import {
  badRequest,
  getUserAndRole,
  notFound,
  serverError,
  soloOrganizacion,
} from "@/lib/api-auth";
import {
  BUCKET_FOTOS,
  borrarFoto,
  esTipoImagenPermitido,
  rutaFoto,
  TAMANO_MAXIMO_BYTES,
  urlFirmada,
} from "@/lib/cliente-foto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * /api/clientes/[id]/foto — fotografía de un cliente.
 *
 *   POST   multipart con el campo `file` → sube y reemplaza
 *   DELETE                                → elimina
 *
 * Aislamiento, en tres capas que se refuerzan:
 *
 *   1. `soloOrganizacion` corta al megaadministrador y a quien no tenga
 *      organización.
 *   2. El SELECT previo pasa por RLS: si el cliente es de otra organización no
 *      aparece y se responde 404, sin confirmar siquiera que ese id exista.
 *   3. La subida va con el cliente de SESIÓN, así que las policies de Storage
 *      vuelven a comprobar que la carpeta raíz de la ruta es el tenant.
 *
 * Todo se hace con el cliente de sesión a propósito. Usar service_role aquí
 * sería más cómodo y saltaría las tres comprobaciones de golpe.
 */

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  // RLS decide: un cliente de otra organización simplemente no existe aquí.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, admin_id, foto_path")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) return notFound("Cliente no encontrado");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Se esperaba un formulario con la imagen");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("No se recibió ninguna imagen");
  }

  if (file.size === 0) {
    return badRequest("El archivo está vacío o se corrompió al subirlo");
  }

  if (file.size > TAMANO_MAXIMO_BYTES) {
    const mb = (TAMANO_MAXIMO_BYTES / 1024 / 1024).toFixed(0);
    return badRequest(`La imagen supera el máximo de ${mb} MB`);
  }

  if (!esTipoImagenPermitido(file.type)) {
    return badRequest("Formato no admitido. Usa JPG, PNG, WEBP, GIF o HEIC.");
  }

  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : (file.type.split("/")[1] ?? "webp").replace("+xml", "");

  const path = rutaFoto(cliente.admin_id as string, id, extension);

  const { error: subidaError } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (subidaError) {
    console.error("[clientes/foto POST]", subidaError.message);
    return serverError("No se pudo subir la imagen. Inténtalo de nuevo.");
  }

  const anterior = cliente.foto_path as string | null;

  const { error: updError } = await supabase
    .from("clientes")
    .update({ foto_path: path })
    .eq("id", id);

  if (updError) {
    // La fila no se actualizó, así que el archivo recién subido no lo apunta
    // nadie: se retira para no dejar basura en el bucket.
    await borrarFoto(supabase, path);
    console.error("[clientes/foto POST] update", updError.message);
    return serverError("No se pudo guardar la referencia de la imagen");
  }

  // La anterior se borra sólo cuando la nueva ya está en su sitio y referenciada.
  if (anterior && anterior !== path) {
    await borrarFoto(supabase, anterior);
  }

  return NextResponse.json({
    ok: true,
    foto_path: path,
    foto_url: await urlFirmada(supabase, path),
  });
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const bloqueo = soloOrganizacion(session);
  if (bloqueo) return bloqueo;

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, foto_path")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) return notFound("Cliente no encontrado");

  const path = cliente.foto_path as string | null;
  if (!path) return NextResponse.json({ ok: true, foto_path: null });

  // Primero se desreferencia y luego se borra: si el borrado del archivo
  // fallara, el cliente ya se ve sin foto y no queda apuntando a algo roto.
  const { error } = await supabase
    .from("clientes")
    .update({ foto_path: null })
    .eq("id", id);

  if (error) return serverError("No se pudo eliminar la imagen");

  await borrarFoto(supabase, path);

  return NextResponse.json({ ok: true, foto_path: null });
}
