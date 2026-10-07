/**
 * mantenimiento-avisos.ts — Avisos de mantenimiento vencido.
 *
 * Cuando el cobro de un administrador vence —incluido el final de un MES DE
 * PRUEBA— se hacen dos cosas, una sola vez por vencimiento:
 *
 *   1. Se le crea un MENSAJE al administrador, que verá como isla al entrar.
 *   2. Se envía un CORREO al megaadministrador avisando del pago pendiente.
 *
 * `aviso_vencimiento_en` en `admin_maintenance` es lo que impide repetirlo:
 * se marca después de avisar y sólo vuelve a dispararse si el vencimiento
 * avanza a una fecha posterior. Sin eso, cada carga del panel generaría un
 * mensaje y un correo nuevos.
 *
 * El destinatario del correo NO está escrito en el código: se toma el email
 * del perfil `super_admin`. Así sigue siendo correcto si esa cuenta cambia.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PorAvisar = {
  admin_id: string;
  nombre: string | null;
  email: string | null;
  monto: number | null;
  proximo_pago: string | null;
  venia_de_prueba: boolean;
};

export type ResultadoAvisos = {
  procesados: number;
  mensajesCreados: number;
  correoEnviado: boolean;
  motivoCorreo?: string;
};

function moneda(v: number | null): string {
  if (v == null) return "el monto acordado";
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(v);
}

function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  // Se parte la cadena en vez de usar new Date() para no desplazar el día
  // según la zona horaria del servidor.
  const [a, m, d] = iso.split("-");
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const mes = meses[Number(m) - 1] ?? m;
  return `${Number(d)} de ${mes} de ${a}`;
}

/** Correo al megaadministrador con la lista de cobros vencidos. */
function correoPagosPendientes(pendientes: PorAvisar[]): {
  subject: string;
  html: string;
  text: string;
} {
  const filas = pendientes
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#0A0E17;">
          ${p.nombre ?? "—"}
          ${p.venia_de_prueba ? '<br><span style="font-size:12px;color:#5C6B89;">Fin del mes de prueba</span>' : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#5C6B89;">
          ${fechaLarga(p.proximo_pago)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:right;color:#0A0E17;font-weight:600;">
          ${moneda(p.monto)}
        </td>
      </tr>`,
    )
    .join("");

  const n = pendientes.length;
  const subject =
    n === 1
      ? `Pago de sistema pendiente — ${pendientes[0].nombre ?? "un administrador"}`
      : `${n} pagos de sistema pendientes`;

  const html = `
<div style="background:#F1F5F9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:linear-gradient(135deg,#002B6B 0%,#0044AA 100%);padding:20px 24px;">
      <p style="margin:0;color:#FFFFFF;font-size:16px;font-weight:600;">Mantenimiento pendiente</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">Préstamos Elicar</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#0A0E17;font-size:14px;line-height:1.6;">
        ${n === 1 ? "Hay un pago de sistema pendiente." : `Hay ${n} pagos de sistema pendientes.`}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#5C6B89;font-weight:500;border-bottom:1px solid #E2E8F0;">Administrador</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#5C6B89;font-weight:500;border-bottom:1px solid #E2E8F0;">Venció</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#5C6B89;font-weight:500;border-bottom:1px solid #E2E8F0;">Monto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  </div>
</div>`;

  const text = [
    n === 1
      ? "Hay un pago de sistema pendiente."
      : `Hay ${n} pagos de sistema pendientes.`,
    "",
    ...pendientes.map(
      (p) =>
        `- ${p.nombre ?? "—"}${p.venia_de_prueba ? " (fin del mes de prueba)" : ""} · venció ${fechaLarga(p.proximo_pago)} · ${moneda(p.monto)}`,
    ),
  ].join("\n");

  return { subject, html, text };
}

/**
 * Procesa los vencimientos pendientes de avisar.
 *
 * No lanza nunca: un fallo del correo no debe tumbar la carga del panel ni
 * impedir que se cree el mensaje al administrador, que es lo importante.
 */
export async function procesarAvisosMantenimiento(): Promise<ResultadoAvisos> {
  const db = createSupabaseAdminClient();

  const { data, error } = await db.rpc("mantenimientos_por_avisar");
  if (error) {
    console.error("[mantenimiento-avisos] consulta", error.message);
    return { procesados: 0, mensajesCreados: 0, correoEnviado: false };
  }

  const pendientes = (data ?? []) as PorAvisar[];
  if (pendientes.length === 0) {
    return { procesados: 0, mensajesCreados: 0, correoEnviado: false };
  }

  // ── 1. Mensaje para cada administrador ──
  const mensajes = pendientes.map((p) => ({
    admin_id: p.admin_id,
    titulo: p.venia_de_prueba
      ? "Tu mes de prueba ha terminado"
      : "Pago de mantenimiento pendiente",
    cuerpo: p.venia_de_prueba
      ? `Tu mes de prueba terminó el ${fechaLarga(p.proximo_pago)}. Para seguir usando el sistema, realiza el pago de ${moneda(p.monto)}.`
      : `Tu pago de mantenimiento venció el ${fechaLarga(p.proximo_pago)}. Monto pendiente: ${moneda(p.monto)}.`,
    tipo: "URGENTE" as const,
  }));

  const { error: msgError } = await db.from("admin_messages").insert(mensajes);
  if (msgError) {
    console.error("[mantenimiento-avisos] mensajes", msgError.message);
  }

  // ── 2. Correo al megaadministrador ──
  let correoEnviado = false;
  let motivoCorreo: string | undefined;

  const { data: mega } = await db
    .from("profiles")
    .select("email")
    .eq("role", "super_admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  if (!mega?.email) {
    motivoCorreo = "no hay megaadministrador activo con correo";
  } else if (!resendKey || !resendFrom) {
    motivoCorreo = "RESEND_API_KEY / RESEND_FROM_EMAIL no configurados";
  } else {
    try {
      const { subject, html, text } = correoPagosPendientes(pendientes);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [mega.email],
          subject,
          html,
          text,
        }),
      });
      correoEnviado = res.ok;
      if (!res.ok) motivoCorreo = `Resend respondió ${res.status}`;
    } catch (err) {
      motivoCorreo = err instanceof Error ? err.message : "error de red";
    }
  }

  if (motivoCorreo) {
    console.error("[mantenimiento-avisos] correo no enviado:", motivoCorreo);
  }

  // ── 3. Marcar como avisados ──
  // Se marca aunque el correo falle: el mensaje al administrador —que es la
  // notificación que de verdad le llega— ya está creado, y repetirlo en cada
  // carga del panel le llenaría la pantalla de avisos duplicados.
  for (const p of pendientes) {
    await db.rpc("marcar_aviso_mantenimiento", { p_admin_id: p.admin_id });
  }

  return {
    procesados: pendientes.length,
    mensajesCreados: msgError ? 0 : mensajes.length,
    correoEnviado,
    motivoCorreo,
  };
}
