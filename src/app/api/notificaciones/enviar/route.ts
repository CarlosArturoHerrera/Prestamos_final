import { NextResponse } from "next/server";
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth";
import {
  construirMensajeReporte,
  obtenerMorososRepresentante,
} from "@/lib/cobranza";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveMoraTemplateSid,
  resolveTwilioWhatsAppFrom,
  serializeTwilioSendError,
  toTwilioWhatsAppAddress,
} from "@/lib/twilio-whatsapp";
import { notificacionEnviarSchema } from "@/lib/validations/schemas";

async function enviarEmailResend(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    return {
      ok: false,
      error: "RESEND_API_KEY o RESEND_FROM_EMAIL no configurados",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = notificacionEnviarSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida");
  }

  const { representanteIds, enviarATodos, canal, vistaPrevia } = parsed.data;

  let repsQuery = supabase.from("representantes").select("*");

  if (enviarATodos) {
    /* todos */
  } else {
    repsQuery = repsQuery.in("id", representanteIds ?? []);
  }

  const { data: representantes, error: re } = await repsQuery;

  if (re) {
    return NextResponse.json({ error: re.message }, { status: 400 });
  }

  const resultados: unknown[] = [];

  const needsWa = canal === "WHATSAPP" || canal === "AMBOS";

  const fromResolved = needsWa ? resolveTwilioWhatsAppFrom() : null;
  const waFromFinal =
    fromResolved && fromResolved.ok ? fromResolved.value : null;

  // Inicializar cliente con API Key (no TWILIO_AUTH_TOKEN)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let twilioClient: any = null;
  if (needsWa) {
    const { createTwilioClient } = await import("@/lib/twilio-whatsapp");
    const cr = await createTwilioClient();
    if (cr.ok) twilioClient = cr.client;
  }

  for (const rep of representantes ?? []) {
    const { lineas, total_cartera_mora } = await obtenerMorososRepresentante(
      supabase,
      rep.id,
    );
    const nombreRep = `${rep.nombre} ${rep.apellido}`;
    const mensaje = construirMensajeReporte(
      nombreRep,
      lineas,
      total_cartera_mora,
    );

    const clientesJson = lineas.map((l) => ({
      cliente_id: l.cliente_id,
      prestamo_id: l.prestamo_id,
      nombre: l.nombre_completo,
      cedula: l.cedula,
      monto_pendiente: l.monto_pendiente,
      dias_atraso: l.dias_atraso,
      ultimo_pago: l.ultimo_pago,
    }));

    if (vistaPrevia) {
      resultados.push({
        representante_id: rep.id,
        mensaje,
        clientes_incluidos: clientesJson,
      });
      continue;
    }

    const enviarWa = canal === "WHATSAPP" || canal === "AMBOS";
    const enviarEm = canal === "EMAIL" || canal === "AMBOS";

    const errores: string[] = [];
    let waOk = false;
    let emOk = false;

    let twilioFromDb: string | null = null;
    let twilioToDb: string | null = null;
    let twilioSidDb: string | null = null;
    let twilioStatusDb: string | null = null;
    const emailToDb = enviarEm && rep.email ? String(rep.email).trim() : null;

    if (enviarWa) {
      if (!fromResolved || !fromResolved.ok || !waFromFinal) {
        errores.push(
          fromResolved && !fromResolved.ok
            ? fromResolved.reason
            : "TWILIO_WHATSAPP_FROM no configurado",
        );
      } else if (!twilioClient) {
        errores.push(
          "Twilio: faltan TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID o TWILIO_API_KEY_SECRET",
        );
      } else {
        let toFinal: string;
        try {
          toFinal = toTwilioWhatsAppAddress(String(rep.telefono ?? ""));
        } catch (e) {
          errores.push(
            e instanceof Error
              ? e.message
              : "Teléfono del representante inválido para WhatsApp",
          );
          toFinal = "";
        }

        if (toFinal) {
          twilioFromDb = waFromFinal;
          twilioToDb = toFinal;

          const templateResult = resolveMoraTemplateSid();
          if (!templateResult.ok) {
            errores.push(templateResult.reason);
          } else {
            const fechaReporte = new Intl.DateTimeFormat("es-DO", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date());

            const cvars = {
              "1": nombreRep,
              "2": fechaReporte,
              "3": lineas.length.toString(),
            };

            const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
            const statusCallback = appUrl
              ? `${appUrl}/api/twilio/status`
              : undefined;

            const createParams: Record<string, unknown> = {
              from: waFromFinal,
              to: toFinal,
              contentSid: templateResult.sid,
              contentVariables: JSON.stringify(cvars),
              // body intencionalmente ausente — se usa Content Template
            };
            if (statusCallback) createParams.statusCallback = statusCallback;

            console.info(
              "[twilio-whatsapp] PREFLIGHT — usando contentSid, SIN body",
              {
                from: waFromFinal,
                to: toFinal,
                contentSid: templateResult.sid,
                contentVariables: cvars,
                statusCallback:
                  statusCallback ??
                  "(sin callback — NEXT_PUBLIC_APP_URL no configurado)",
                usaBody: false,
              },
            );

            try {
              const sent = await twilioClient.messages.create(createParams);
              twilioSidDb = sent.sid ?? null;
              twilioStatusDb = "PROCESANDO";
              waOk = true;
              console.info("[twilio-whatsapp] mensaje aceptado por Twilio", {
                sid: sent.sid,
                status: sent.status,
                to: toFinal,
              });
            } catch (e) {
              const detail = serializeTwilioSendError(e);
              errores.push(detail);
              console.error("[twilio-whatsapp] messages.create falló", {
                from: waFromFinal,
                to: toFinal,
                detail,
              });
            }
          }
        }
      }
    }

    if (enviarEm) {
      const r = await enviarEmailResend(
        rep.email,
        "Reporte de mora — cartera",
        mensaje,
      );
      if (r.ok) {
        emOk = true;
      } else {
        errores.push(r.error ?? "Error email");
      }
    }

    // Para WA: PROCESANDO (esperando callback de Twilio). Para email: ENVIADO. Si nada: ERROR.
    const estado: string = waOk
      ? (twilioStatusDb ?? "PROCESANDO")
      : emOk
        ? "ENVIADO"
        : "ERROR";
    const errorDetalle = errores.length ? errores.join(" | ") : null;

    const basePayload = {
      representante_id: rep.id,
      canal,
      mensaje,
      clientes_incluidos: clientesJson,
      fecha_envio: new Date().toISOString(),
      estado,
      error_detalle: errorDetalle,
    };

    const extendedPayload: Record<string, unknown> = {
      ...basePayload,
      twilio_from: twilioFromDb,
      twilio_to: twilioToDb,
      twilio_message_sid: twilioSidDb,
      email_to: emailToDb,
    };

    let { data: ins, error: insE } = await supabase
      .from("notificaciones")
      .insert(extendedPayload)
      .select()
      .single();

    if (insE) {
      // Si el error es por columnas que no existen aún, reintentamos con campos base
      const isColumnError =
        insE.code === "42703" ||
        insE.message.toLowerCase().includes("column") ||
        insE.message.toLowerCase().includes("schema cache");
      console.error("[notificaciones/enviar] insert error", {
        code: insE.code,
        message: insE.message,
        willRetry: isColumnError,
      });

      if (isColumnError) {
        const retry = await supabase
          .from("notificaciones")
          .insert(basePayload)
          .select()
          .single();
        ins = retry.data;
        insE = retry.error;
        if (retry.error) {
          console.error(
            "[notificaciones/enviar] retry insert also failed",
            retry.error.message,
          );
        }
      }
    }

    if (insE) {
      resultados.push({
        representante_id: rep.id,
        estado: "ERROR",
        error: insE.message,
      });
    } else {
      resultados.push(ins);
    }
  }

  return NextResponse.json({ data: resultados });
}
