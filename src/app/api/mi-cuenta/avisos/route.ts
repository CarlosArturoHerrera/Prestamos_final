import { NextResponse } from "next/server";
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /api/mi-cuenta/avisos — lo que el administrador debe ver al entrar (§22, §23).
 *
 *   GET   → estado de mantenimiento + mensajes vigentes sin leer
 *   PATCH → marcar un mensaje como leído
 *
 * Usa el cliente con cookies, NO service_role: así las policies RLS son las
 * que deciden qué ve cada quien. Un administrador sólo alcanza su propia ficha
 * de mantenimiento y sus propios mensajes; no hace falta ningún filtro manual.
 *
 * Los subusuarios comparten el `adminId` de su administrador, así que verían
 * sus mensajes. Como el mantenimiento es un asunto entre el megaadministrador
 * y el titular de la cuenta, aquí se devuelve vacío para ellos.
 */

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  // Sin organización (megaadministrador) o rol no titular: nada que avisar.
  if (!session.adminId || session.role !== "admin") {
    return NextResponse.json({ mantenimiento: null, mensajes: [] });
  }

  // Pone al día el estado antes de leerlo: un vencimiento de ayer debe salir
  // como VENCIDO aunque no haya pasado ningún proceso programado.
  await supabase.rpc("refrescar_estado_mantenimiento", {
    p_admin_id: session.adminId,
  });

  const ahora = new Date().toISOString();

  const [{ data: mantenimiento }, { data: mensajes }] = await Promise.all([
    supabase
      .from("admin_maintenance")
      .select("estado, dia_pago, monto, ultimo_pago, proximo_pago, notas")
      .eq("admin_id", session.adminId)
      .maybeSingle(),
    supabase
      .from("admin_messages")
      .select("id, titulo, cuerpo, tipo, created_at, expira_en")
      .is("leido_en", null)
      .or(`expira_en.is.null,expira_en.gt.${ahora}`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Sólo se avisa cuando hay algo que atender: AL_DIA y EXENTO no molestan.
  const requiereAtencion =
    mantenimiento != null &&
    (mantenimiento.estado === "PENDIENTE" ||
      mantenimiento.estado === "VENCIDO");

  return NextResponse.json({
    mantenimiento: requiereAtencion ? mantenimiento : null,
    mensajes: mensajes ?? [],
  });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "number" && typeof id !== "string") {
    return badRequest("Falta el identificador del mensaje");
  }

  // Marcar como leído es la ÚNICA mutación que el destinatario puede hacer.
  // Si intentara tocar el contenido, el trigger proteger_contenido_mensaje lo
  // rechazaría; y la RLS ya impide alcanzar mensajes de otra organización.
  const { error } = await supabase
    .from("admin_messages")
    .update({ leido_en: new Date().toISOString() })
    .eq("id", id);

  if (error) return badRequest(error.message);

  return NextResponse.json({ message: "Mensaje marcado como leído" });
}
