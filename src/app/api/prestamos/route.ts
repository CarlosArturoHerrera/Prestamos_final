import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import {
  abonosCountFromRow,
  calcularFechasNuevoPrestamo,
  proyectarProximaCuota,
} from "@/lib/prestamo-logic"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prestamoCreateSchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get("clienteId")
  const estado = searchParams.get("estado")

  let q = supabase
    .from("prestamos")
    .select(
      `
      *,
      clientes (
        id,
        nombre,
        apellido,
        cedula,
        representantes ( id, nombre, apellido ),
        empresas ( id, nombre )
      ),
      abonos(count)
    `,
    )
    .order("created_at", { ascending: false })

  if (clienteId) {
    q = q.eq("cliente_id", Number(clienteId))
  }
  if (estado) {
    q = q.eq("estado", estado)
  }

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const rows = (data ?? []).map((raw) => {
    const n = abonosCountFromRow(raw as { abonos?: { count?: number }[] | null })
    const { abonos: _a, ...prestamo } = raw as {
      abonos?: { count?: number }[] | null
      capital_pendiente: string | number
      tasa_interes: string | number
      plazo: number
      estado: string
      [key: string]: unknown
    }
    const proj = proyectarProximaCuota(
      String(prestamo.capital_pendiente),
      String(prestamo.tasa_interes),
      Number(prestamo.plazo),
      n,
      String(prestamo.estado),
    )
    return {
      ...prestamo,
      abonos_realizados: n,
      interes_proximo: proj.interesProximo,
      capital_debitar_proximo: proj.capitalDebitarSugerido,
      total_proximo_pago: proj.totalProximoPago,
    }
  })

  return NextResponse.json({ data: rows })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = prestamoCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const { fecha_proximo_vencimiento, fecha_vencimiento } = calcularFechasNuevoPrestamo(
    parsed.data.fechaInicio,
    parsed.data.tipoPlazo,
    parsed.data.plazo,
  )
  const fechaProximo = parsed.data.fechaProximoPago ?? fecha_proximo_vencimiento

  const montoStr = String(parsed.data.monto)

  const insert = {
    cliente_id: parsed.data.clienteId,
    monto: montoStr,
    tasa_interes: String(parsed.data.tasaInteres),
    plazo: parsed.data.plazo,
    tipo_plazo: parsed.data.tipoPlazo,
    fecha_inicio: parsed.data.fechaInicio,
    fecha_vencimiento,
    fecha_proximo_vencimiento: fechaProximo,
    capital_pendiente: montoStr,
    estado: "ACTIVO" as const,
    notas: parsed.data.notas?.trim() || null,
  }

  const { data, error } = await supabase.from("prestamos").insert(insert).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
