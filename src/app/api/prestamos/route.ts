import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import {
  calcularFechasNuevoPrestamo,
  sincronizarPrestamosListadoSiCorresponde,
} from "@/lib/prestamo-logic"
import {
  createPrestamosListQuery,
  enrichPrestamoListRowsWithFlags,
  mapPrestamoListRowFromRaw,
  resolvePrestamosListPreFilters,
} from "@/lib/prestamos-list-query"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prestamoCreateSchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get("clienteId")
  const estado = searchParams.get("estado")
  const qText = (searchParams.get("q") || "").trim()
  const conInteresPendiente = searchParams.get("conInteresPendiente") === "true"
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 50)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const pre = await resolvePrestamosListPreFilters(supabase, qText, conInteresPendiente)
  if (pre.empty) {
    return NextResponse.json({ data: [], page, pageSize, total: 0 })
  }

  const q = createPrestamosListQuery(supabase, pre, { clienteId, estado }, "exact")
  const { data, error, count } = await q.range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const lista = (data ?? []) as Record<string, unknown>[]
  if (lista.length > 0) {
    await sincronizarPrestamosListadoSiCorresponde(supabase, lista)
  }

  const rowsBase = lista.map((raw) => mapPrestamoListRowFromRaw(raw))
  const rows = await enrichPrestamoListRowsWithFlags(supabase, rowsBase)

  return NextResponse.json({ data: rows, page, pageSize, total: count ?? 0 })
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
    capital_a_debitar: String(parsed.data.capitalADebitar),
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
