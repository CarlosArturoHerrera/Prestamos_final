import type { SupabaseClient } from "@supabase/supabase-js"

export type ClienteMorosoLinea = {
  cliente_id: number
  prestamo_id: number
  nombre_completo: string
  monto_pendiente: string
  dias_atraso: number
  ultimo_pago: string | null
}

export async function obtenerMorososRepresentante(
  supabase: SupabaseClient,
  representanteId: number,
): Promise<{ lineas: ClienteMorosoLinea[]; total_cartera_mora: string }> {
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, ultimo_pago")
    .eq("representante_id", representanteId)

  const cids = (clientes ?? []).map((c) => c.id)
  if (cids.length === 0) {
    return { lineas: [], total_cartera_mora: "0.00" }
  }

  const { data: prestamos } = await supabase
    .from("prestamos")
    .select("id, cliente_id, capital_pendiente, fecha_proximo_vencimiento, estado")
    .in("cliente_id", cids)
    .in("estado", ["ACTIVO", "MORA"])

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const lineas: ClienteMorosoLinea[] = []

  for (const p of prestamos ?? []) {
    const vence = new Date(`${p.fecha_proximo_vencimiento}T12:00:00`)
    const esMora = p.estado === "MORA" || vence < hoy
    if (!esMora) continue

    const c = (clientes ?? []).find((x) => x.id === p.cliente_id)
    if (!c) continue

    const diff = Math.floor((hoy.getTime() - vence.getTime()) / (1000 * 60 * 60 * 24))
    const dias_atraso = diff > 0 ? diff : 0

    lineas.push({
      cliente_id: c.id,
      prestamo_id: p.id,
      nombre_completo: `${c.nombre} ${c.apellido}`,
      monto_pendiente: String(p.capital_pendiente),
      dias_atraso,
      ultimo_pago: c.ultimo_pago,
    })
  }

  const total = lineas.reduce((a, l) => a + Number(l.monto_pendiente), 0)
  return {
    lineas,
    total_cartera_mora: total.toFixed(2),
  }
}

export function construirMensajeReporte(
  nombreRepresentante: string,
  lineas: ClienteMorosoLinea[],
  total: string,
): string {
  const fecha = new Date().toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  let msg = `Hola ${nombreRepresentante},\n\n`
  msg += `Reporte de cartera en mora / atraso — ${fecha}\n\n`

  if (lineas.length === 0) {
    msg += "No hay clientes en mora en este momento.\n"
    return msg
  }

  msg += "Detalle:\n"
  for (const l of lineas) {
    const up = l.ultimo_pago ? `Último pago: ${l.ultimo_pago}` : "Sin último pago registrado"
    msg += `- ${l.nombre_completo} | Pendiente RD$ ${Number(l.monto_pendiente).toLocaleString("es-DO")} | Atraso: ${l.dias_atraso} días | ${up}\n`
  }

  msg += `\nTotal cartera en mora: RD$ ${Number(total).toLocaleString("es-DO")}\n`
  return msg
}
