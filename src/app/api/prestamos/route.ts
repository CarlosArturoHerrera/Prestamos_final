import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { calcularFechasNuevoPrestamo } from "@/lib/prestamo-logic"
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
      )
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

  return NextResponse.json({ data: data ?? [] })
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

  const montoStr = String(parsed.data.monto)

  const insert = {
    cliente_id: parsed.data.clienteId,
    monto: montoStr,
    tasa_interes: String(parsed.data.tasaInteres),
    plazo: parsed.data.plazo,
    tipo_plazo: parsed.data.tipoPlazo,
    fecha_inicio: parsed.data.fechaInicio,
    fecha_vencimiento,
    fecha_proximo_vencimiento,
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
