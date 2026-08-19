import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth";
import { interesPeriodo } from "@/lib/finance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST as registrarAbono } from "../abonos/route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Salda un préstamo por completo.
 *
 * No implementa cálculo propio de pagos: sólo averigua cuánto debe el cliente y
 * delega en las piezas que ya usa el módulo. El interés del período sale de
 * `interesPeriodo` —la misma función que usa el endpoint de abonos— y la
 * aplicación del pago se hace invocando ese mismo handler, de modo que las
 * reglas de interés, capital, fechas, estado e historial son literalmente las
 * de «Registrar abono».
 *
 * El abono cubre el interés del período en curso y todo el capital. Los
 * intereses pendientes de períodos anteriores quedan fuera de su alcance (el
 * handler sólo toca el período de `fecha_proximo_vencimiento`), así que se
 * liquidan aparte con la misma actualización que aplica «marcar pagado».
 */
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return badRequest("ID inválido");

  // Estado real y actual del préstamo: nunca el que trajera la pantalla.
  const { data: prestamo, error: pe } = await supabase
    .from("prestamos")
    .select("*")
    .eq("id", id)
    .single();

  if (pe || !prestamo) {
    return NextResponse.json(
      { error: "Préstamo no encontrado" },
      { status: 404 },
    );
  }

  // Corta los clics repetidos: el segundo encuentra el préstamo ya saldado.
  if (prestamo.estado === "SALDADO") {
    return badRequest("El préstamo ya está saldado");
  }

  const capitalPendiente = String(prestamo.capital_pendiente);
  const fechaPeriodo = String(prestamo.fecha_proximo_vencimiento);
  const interesDelPeriodo = interesPeriodo(
    capitalPendiente,
    String(prestamo.tasa_interes),
  );

  const { data: pendientes, error: ie } = await supabase
    .from("intereses_atrasados")
    .select(
      "id, estado, monto, interes_pendiente, fecha_periodo, fecha_generado, aplicado, fecha_aplicado",
    )
    .eq("prestamo_id", id)
    .eq("estado", "PENDIENTE");

  if (ie) {
    return NextResponse.json({ error: ie.message }, { status: 400 });
  }

  // El período en curso lo cubre el propio abono; aquí sólo el arrastre.
  const anteriores = (pendientes ?? []).filter(
    (row) =>
      String(row.fecha_periodo ?? row.fecha_generado ?? "") !== fechaPeriodo,
  );

  const deuda = new Decimal(capitalPendiente).plus(interesDelPeriodo);
  if (deuda.lte(0) && anteriores.length === 0) {
    return badRequest("El préstamo no tiene deuda pendiente");
  }

  const hoy = new Date().toISOString().slice(0, 10);

  // Mismo mecanismo de atomicidad que `aplicar-interes-atrasado`: se guarda el
  // estado previo para poder devolverlo si el abono no llega a registrarse.
  const snapshots = anteriores.map((row) => ({
    id: row.id as number,
    estado: String(row.estado ?? "PENDIENTE"),
    interes_pendiente: String(row.interes_pendiente ?? row.monto ?? "0"),
    monto: String(row.monto ?? row.interes_pendiente ?? "0"),
    aplicado: Boolean(row.aplicado),
    fecha_aplicado: row.fecha_aplicado as string | null,
  }));

  const restaurarIntereses = async () => {
    for (const s of snapshots) {
      await supabase
        .from("intereses_atrasados")
        .update({
          estado: s.estado,
          interes_pendiente: s.interes_pendiente,
          monto: s.monto,
          aplicado: s.aplicado,
          fecha_aplicado: s.fecha_aplicado,
        })
        .eq("id", s.id);
    }
  };

  if (snapshots.length > 0) {
    const { error: ue } = await supabase
      .from("intereses_atrasados")
      .update({
        estado: "PAGADO",
        interes_pendiente: "0.00",
        monto: "0.00",
        aplicado: false,
        fecha_aplicado: hoy,
      })
      .in(
        "id",
        snapshots.map((s) => s.id),
      )
      .eq("estado", "PENDIENTE");

    if (ue) {
      return NextResponse.json({ error: ue.message }, { status: 400 });
    }
  }

  // Se reutiliza el handler de «Registrar abono» tal cual: cubrir el interés
  // del período y todo el capital deja el saldo en 0 y el estado en SALDADO.
  const abonoRequest = new Request(
    new URL(`/api/prestamos/${id}/abonos`, request.url),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fechaAbono: hoy,
        interesRecibido: interesDelPeriodo,
        montoCapitalDebitado: capitalPendiente,
        observaciones: "Saldo total del préstamo",
      }),
    },
  );

  const respuesta = await registrarAbono(abonoRequest, ctx);

  if (!respuesta.ok) {
    await restaurarIntereses();
    return respuesta;
  }

  return NextResponse.json({
    ok: true,
    id,
    interesPagado: interesDelPeriodo,
    capitalDebitado: capitalPendiente,
    interesesAnterioresLiquidados: snapshots.length,
  });
}
