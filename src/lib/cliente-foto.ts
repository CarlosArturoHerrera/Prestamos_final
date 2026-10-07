/**
 * cliente-foto.ts — Fotografías de clientes en Supabase Storage.
 *
 * El bucket `clientes-fotos` es PRIVADO. Nada se sirve por URL pública: las
 * imágenes se entregan con URLs firmadas que caducan, generadas en el servidor
 * con el cliente de sesión, de modo que las policies de Storage deciden si la
 * ruta pertenece o no a la organización de quien pregunta.
 *
 * La ruta es `<admin_id>/<cliente_id>/<archivo>`. Que el tenant sea el primer
 * segmento es lo que permite aplicar el aislamiento en Storage con la misma
 * `current_tenant_id()` que usa el resto del sistema.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_FOTOS = "clientes-fotos";

/** Caducidad de las URLs firmadas. Una hora cubre de sobra una sesión de uso. */
const FIRMA_SEGUNDOS = 60 * 60;

export const TIPOS_IMAGEN_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

/** 5 MB. El navegador ya comprime antes de subir; esto es el tope duro. */
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export function esTipoImagenPermitido(tipo: string): boolean {
  return (TIPOS_IMAGEN_PERMITIDOS as readonly string[]).includes(
    tipo.toLowerCase(),
  );
}

/** Construye la ruta canónica de una foto. */
export function rutaFoto(
  adminId: string,
  clienteId: number,
  extension: string,
): string {
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  // El sufijo aleatorio evita que el navegador sirva la imagen anterior desde
  // su caché cuando se reemplaza la foto de un cliente.
  const unico = crypto.randomUUID().slice(0, 8);
  return `${adminId}/${clienteId}/${Date.now()}-${unico}.${ext}`;
}

/**
 * URL firmada de una foto, o null si no hay foto o la firma falla.
 *
 * Se usa el cliente de SESIÓN a propósito: si la ruta no pertenece a la
 * organización de quien pregunta, las policies de Storage impiden firmarla y
 * aquí sale null. No hay forma de obtener la foto de otro administrador ni
 * conociendo la ruta exacta.
 */
export async function urlFirmada(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrl(path, FIRMA_SEGUNDOS);

  if (error) {
    // No se registra la ruta completa: en un listado ajeno sería ruido, y aquí
    // basta saber que una firma falló.
    console.error("[cliente-foto] no se pudo firmar la URL:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Firma en lote las fotos de una lista de clientes.
 *
 * Supabase expone `createSignedUrls` (plural), que resuelve todo el listado en
 * una sola llamada. Hacerlo de una en una convertiría una página de 20 clientes
 * en 20 peticiones a Storage.
 */
export async function urlsFirmadas(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(unicos, FIRMA_SEGUNDOS);

  if (error) {
    console.error("[cliente-foto] firma en lote fallida:", error.message);
    return mapa;
  }

  for (const fila of data ?? []) {
    if (fila.signedUrl && fila.path) mapa.set(fila.path, fila.signedUrl);
  }
  return mapa;
}

/**
 * Borra una foto del bucket. No lanza: que quede un archivo huérfano es menos
 * grave que impedir al usuario cambiar la foto o borrar el cliente.
 */
export async function borrarFoto(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove([path]);
  if (error) {
    console.error("[cliente-foto] no se pudo borrar:", error.message);
  }
}
