import { NextResponse } from "next/server"
import { startOfMonth } from "date-fns"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const inicioMes = startOfMonth(new Date()).toISOString().slice(0, 10)

  const { data: activos } = await supabase
    .from("prestamos")
    .select("cliente_id")
    .eq("estado", "ACTIVO")

  const clientesActivos = new Set((activos ?? []).map((r) => r.cliente_id)).size

  const [
    { count: prestamosMora },
    { data: abonosMes },
    { data: proximos },
    { data: abonosRecientes },
  ] = await Promise.all([
    supabase.from("prestamos").select("*", { count: "exact", head: true }).eq("estado", "MORA"),
    supabase.from("abonos").select("total_pagado").gte("fecha_abono", inicioMes),
    supabase
      .from("prestamos")
      .select(
        `
        id,
        fecha_proximo_vencimiento,
        capital_pendiente,
        estado,
        clientes ( nombre, apellido )
      `,
      )
      .in("estado", ["ACTIVO", "MORA"])
      .order("fecha_proximo_vencimiento", { ascending: true })
      .limit(8),
    supabase
      .from("abonos")
      .select(
        `
        id,
        fecha_abono,
        total_pagado,
        prestamo_id,
        prestamos (
          id,
          clientes ( nombre, apellido )
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const recaudacionMes =
    abonosMes?.reduce((a, b) => a + Number(b.total_pagado ?? 0), 0) ?? 0

  return NextResponse.json({
    clientes_activos: clientesActivos,
    prestamos_en_mora: prestamosMora ?? 0,
    recaudacion_mes: recaudacionMes.toFixed(2),
    proximos_vencimientos: proximos ?? [],
    abonos_recientes: abonosRecientes ?? [],
  })
}
