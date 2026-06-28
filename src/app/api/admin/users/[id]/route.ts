import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getUserAndRole,
  requireSuperAdmin,
  badRequest,
  serverError,
  forbidden,
} from "@/lib/api-auth";

const updateAdminSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  action: z.enum(["reset_password"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/users/[id] ──────────────────────────────────────────────
// Update name, email, active status of an admin.
// action="reset_password" sends a password recovery email.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

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

  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { fullName, email, isActive, action } = parsed.data;

  try {
    const adminClient = createSupabaseAdminClient();

    // Prevent super_admin from being disabled
    if (isActive === false) {
      const { data: target } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", targetId)
        .maybeSingle();

      if (target?.role === "super_admin") {
        return forbidden();
      }

      // Also prevent disabling yourself
      if (targetId === auth.userId) {
        return badRequest("No puedes desactivar tu propia cuenta");
      }
    }

    // Handle password reset — generate a Supabase recovery link, then deliver
    // it via Resend (bypasses Supabase's built-in mailer and its rate limits).
    if (action === "reset_password") {
      const { data: target } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", targetId)
        .maybeSingle();

      const targetEmail = target?.email ?? email;
      if (!targetEmail)
        return badRequest("Email no encontrado para este usuario");

      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.NEXTAUTH_URL ??
        "http://localhost:3000";

      const redirectTo = `${siteUrl}/auth/reset-password`;

      console.log(
        `[admin/users PATCH] Generating recovery link → email=${targetEmail} redirectTo=${redirectTo}`,
      );

      // generateLink returns data.properties.action_link — the one-time OTP URL.
      // We send it ourselves via Resend instead of relying on Supabase's mailer.
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
          options: { redirectTo },
        });

      if (linkError) {
        console.error(
          "[admin/users PATCH] generateLink failed:",
          linkError.message,
        );
        return serverError(
          "No se pudo generar el enlace de recuperación: " + linkError.message,
        );
      }

      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        console.error(
          "[admin/users PATCH] generateLink returned no action_link",
        );
        return serverError(
          "No se obtuvo un enlace de recuperación válido. Inténtalo de nuevo.",
        );
      }

      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      const resendFrom = process.env.RESEND_FROM_EMAIL;

      if (!resendKey || !resendFrom) {
        console.error(
          "[admin/users PATCH] RESEND_API_KEY o RESEND_FROM_EMAIL no configurados",
        );
        return serverError(
          "El servidor no tiene configurado el proveedor de correo (Resend). Contacta al super administrador.",
        );
      }

      const emailBody = [
        "Hola,",
        "",
        "Recibiste este correo porque se solicitó restablecer la contraseña de tu cuenta en Préstamos Elicar.",
        "",
        "Haz clic en el siguiente enlace para establecer una nueva contraseña:",
        "",
        actionLink,
        "",
        "Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.",
        "",
        "— Equipo Préstamos Elicar",
      ].join("\n");

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [targetEmail],
          subject: "Restablecer contraseña — Préstamos Elicar",
          text: emailBody,
        }),
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.error("[admin/users PATCH] Resend delivery failed:", resendErr);
        return serverError(
          "No se pudo enviar el correo de recuperación. Verifica la configuración de Resend.",
        );
      }

      console.log(
        `[admin/users PATCH] Recovery email sent via Resend → ${targetEmail}`,
      );
      return NextResponse.json({ message: "Email de recuperación enviado" });
    }

    // Build profile updates
    const profileUpdates: Record<string, unknown> = {};
    if (fullName !== undefined) profileUpdates.full_name = fullName;
    if (email !== undefined) profileUpdates.email = email;
    if (isActive !== undefined) profileUpdates.is_active = isActive;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", targetId);

      if (profileError) return serverError(profileError.message);
    }

    // Sync email in auth.users if email changed
    if (email) {
      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(targetId, { email });
      if (authUpdateError) {
        console.error("[admin/users PATCH] email sync error", authUpdateError);
      }
    }

    return NextResponse.json({ message: "Administrador actualizado" });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return serverError("Error al actualizar el administrador");
  }
}

// ── DELETE /api/admin/users/[id] ─────────────────────────────────────────────
// Permanently deletes an admin user from Auth and profiles.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  // Prevent self-deletion
  if (targetId === auth.userId) {
    return badRequest("No puedes eliminar tu propia cuenta");
  }

  try {
    const adminClient = createSupabaseAdminClient();

    // Verify target is not another super_admin
    const { data: target } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .maybeSingle();

    if (target?.role === "super_admin") {
      return forbidden();
    }

    // Delete from auth.users (cascade deletes profile row)
    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) return serverError(error.message);

    return NextResponse.json({ message: "Administrador eliminado" });
  } catch (err) {
    console.error("[admin/users DELETE]", err);
    return serverError("Error al eliminar el administrador");
  }
}

// ── GET /api/admin/users/[id] ────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteParams) {
  const { id: targetId } = await params;

  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  const auth = requireSuperAdmin(session);
  if (auth instanceof NextResponse) return auth;

  try {
    const adminClient = createSupabaseAdminClient();

    const { data: profile, error } = await adminClient
      .from("profiles")
      .select("id, role, full_name, email, is_active, created_at, updated_at")
      .eq("id", targetId)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!profile)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );

    const { data: authUser } =
      await adminClient.auth.admin.getUserById(targetId);

    return NextResponse.json({
      ...profile,
      last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
    });
  } catch (err) {
    console.error("[admin/users GET :id]", err);
    return serverError("Error al obtener el usuario");
  }
}
