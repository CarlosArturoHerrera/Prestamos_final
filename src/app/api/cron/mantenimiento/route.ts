import { NextResponse } from "next/server";
import { procesarAvisosMantenimiento } from "@/lib/mantenimiento-avisos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/mantenimiento — recalcula estados y envía los avisos pendientes.
 *
 * Existe para que el aviso de vencimiento —y el correo al megaadministrador—
 * salgan aunque nadie abra el panel ese día. El panel también los dispara al
 * cargar, pero depender de eso significaría que un pago vencido en fin de
 * semana no se avisa hasta el lunes.
 *
 * Protegida con `CRON_SECRET`, igual que el resto de rutas de cron. No usa
 * sesión: corre con service_role.
 *
 * Es idempotente: `aviso_vencimiento_en` impide que una segunda ejecución el
 * mismo día repita mensajes o correos.
 */
export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurado en el servidor" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const db = createSupabaseAdminClient();

    // Primero el recálculo: un mes de prueba que terminó ayer tiene que pasar
    // a VENCIDO antes de buscar a quién avisar.
    const { data: recalculados } = await db.rpc(
      "refrescar_estados_mantenimiento",
    );

    const avisos = await procesarAvisosMantenimiento();

    return NextResponse.json({
      ok: true,
      estadosActualizados: recalculados ?? 0,
      ...avisos,
    });
  } catch (err) {
    console.error("[cron/mantenimiento]", err);
    return NextResponse.json(
      { error: "Error procesando el mantenimiento" },
      { status: 500 },
    );
  }
}
