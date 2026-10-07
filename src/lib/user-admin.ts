/**
 * user-admin.ts — Operaciones de alta/baja de usuarios contra Supabase Auth.
 *
 * Centraliza lo que comparten la gestión de ADMINISTRADORES (megaadmin) y la
 * de SUBUSUARIOS (administrador), para no duplicar la lógica delicada:
 * creación del usuario de auth, sincronización del perfil, limpieza si algo
 * falla a mitad, y envío del correo de restablecimiento.
 *
 * Reglas de seguridad que aplica este módulo:
 *   • La contraseña viaja a Supabase Auth y a ningún otro sitio. Nunca se
 *     escribe en profiles, ni en logs, ni en la respuesta HTTP (§5, §7).
 *   • El rol y el administrador propietario los decide quien llama a partir de
 *     la sesión del servidor, jamás el cuerpo de la petición (§15, §29).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/api-auth";
import { recoveryPasswordEmail } from "@/lib/email-templates";
import type { PermissionCode } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CrearUsuarioInput = {
  email: string;
  password: string;
  role: AppRole;
  /** Obligatorio cuando role === "sub_user". */
  adminId?: string | null;
  nombre: string;
  apellido: string;
  username: string;
  telefono?: string | null;
  cedula?: string | null;
};

export type CrearUsuarioResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string };

/** Mapea errores conocidos de Supabase/Postgres a mensajes útiles en español. */
function mensajeDeError(
  raw: string,
): { status: number; message: string } | null {
  const m = raw.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("already been registered")
  ) {
    return { status: 400, message: "Ya existe un usuario con ese correo" };
  }
  if (m.includes("uq_profiles_username_lower") || m.includes("username")) {
    return { status: 400, message: "Ese nombre de usuario ya está en uso" };
  }
  if (
    m.includes("límite de subusuarios") ||
    m.includes("limite de subusuarios")
  ) {
    // El trigger validar_limite_subusuarios ya compone un mensaje legible con
    // las cifras; se deja pasar tal cual en vez de reescribirlo.
    return { status: 400, message: raw.replace(/^.*?ERROR:\s*/i, "").trim() };
  }
  if (m.includes("profiles_hierarchy_check")) {
    return {
      status: 400,
      message:
        "Jerarquía inválida: un subusuario debe pertenecer a un administrador",
    };
  }
  return null;
}

/**
 * Crea un usuario de auth y deja su perfil consistente.
 *
 * Si la actualización del perfil falla, el usuario de auth recién creado se
 * elimina: es preferible no dejar una cuenta capaz de iniciar sesión con un
 * perfil a medias (por ejemplo, un subusuario sin administrador asignado, que
 * sería un usuario sin organización).
 */
export async function crearUsuario(
  input: CrearUsuarioInput,
): Promise<CrearUsuarioResult> {
  const {
    email,
    password,
    role,
    adminId,
    nombre,
    apellido,
    username,
    telefono,
    cedula,
  } = input;

  if (role === "sub_user" && !adminId) {
    return {
      ok: false,
      status: 400,
      message: "Falta el administrador propietario del subusuario",
    };
  }

  const db = createSupabaseAdminClient();

  // Comprobación previa del username: da un error claro en vez de dejar que
  // reviente el índice único después de haber creado el usuario de auth.
  const { data: dup } = await db
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      status: 400,
      message: "Ese nombre de usuario ya está en uso",
    };
  }

  const fullName = `${nombre} ${apellido}`.trim();

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // handle_new_user() usa esta metadata para crear el perfil ya con el rol y
    // el administrador correctos, sin un instante intermedio como 'admin'.
    user_metadata: {
      app_role: role,
      admin_id: role === "sub_user" ? adminId : null,
      username,
      first_name: nombre,
      last_name: apellido,
      full_name: fullName,
      telefono: telefono ?? null,
      cedula: cedula ?? null,
    },
  });

  if (createError || !created?.user) {
    const known = mensajeDeError(createError?.message ?? "");
    return known
      ? { ok: false, ...known }
      : {
          ok: false,
          status: 500,
          message: createError?.message ?? "No se pudo crear el usuario",
        };
  }

  const userId = created.user.id;

  const { error: profileError } = await db
    .from("profiles")
    .update({
      role,
      admin_id: role === "sub_user" ? adminId : null,
      email,
      username,
      first_name: nombre,
      last_name: apellido,
      full_name: fullName,
      telefono: telefono ?? null,
      cedula: cedula ?? null,
      is_active: true,
    })
    .eq("id", userId);

  if (profileError) {
    // Reversión: sin perfil coherente, la cuenta no debe poder iniciar sesión.
    await db.auth.admin.deleteUser(userId).catch(() => {});
    const known = mensajeDeError(profileError.message);
    return known
      ? { ok: false, ...known }
      : { ok: false, status: 500, message: profileError.message };
  }

  return { ok: true, userId };
}

/**
 * Reemplaza por completo el conjunto de permisos de un subusuario.
 * Operación idempotente: borra los actuales e inserta los indicados.
 */
export async function reemplazarPermisos(
  db: SupabaseClient,
  userId: string,
  permisos: PermissionCode[],
  grantedBy: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await db
    .from("user_permissions")
    .delete()
    .eq("user_id", userId);
  if (delError) return { ok: false, message: delError.message };

  if (permisos.length === 0) return { ok: true };

  const filas = permisos.map((code) => ({
    user_id: userId,
    permission_code: code,
    granted_by: grantedBy,
  }));

  const { error: insError } = await db.from("user_permissions").insert(filas);
  if (insError) return { ok: false, message: insError.message };

  return { ok: true };
}

/**
 * Genera un enlace de recuperación de un solo uso y lo entrega por Resend.
 *
 * NO se envía nunca la contraseña actual ni ninguna contraseña en texto plano:
 * sólo un enlace con expiración que permite establecer una nueva (§24).
 * Reutiliza exactamente el mecanismo que ya usaba /api/admin/users/[id].
 */
export async function enviarResetPassword(
  email: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const db = createSupabaseAdminClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink(
    {
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/auth/reset-password` },
    },
  );

  if (linkError) {
    return {
      ok: false,
      status: 500,
      message: `No se pudo generar el enlace de recuperación: ${linkError.message}`,
    };
  }

  const actionLink = linkData?.properties?.action_link;
  if (!actionLink) {
    return {
      ok: false,
      status: 500,
      message:
        "No se obtuvo un enlace de recuperación válido. Inténtalo de nuevo.",
    };
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !resendFrom) {
    return {
      ok: false,
      status: 500,
      message:
        "El servidor no tiene configurado el proveedor de correo (Resend). Contacta al megaadministrador.",
    };
  }

  const { subject, html, text } = recoveryPasswordEmail(actionLink);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // El enlace de recuperación NO se registra: es una credencial efímera.
    console.error("[user-admin] Resend falló", { status: res.status });
    let detail = `(HTTP ${res.status})`;
    try {
      const parsed = JSON.parse(body) as { message?: string; name?: string };
      detail = parsed.message ?? parsed.name ?? detail;
    } catch {
      /* cuerpo no JSON */
    }
    return { ok: false, status: 500, message: `Resend: ${detail}` };
  }

  return { ok: true };
}
