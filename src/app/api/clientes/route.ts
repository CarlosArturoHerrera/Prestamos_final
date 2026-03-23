import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { clienteCreateSchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))
  const search = (searchParams.get("search") || "").trim()
  const representanteId = searchParams.get("representanteId")
  const empresaId = searchParams.get("empresaId")
  const estadoValidacion = searchParams.get("estadoValidacion")

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from("clientes")
    .select(
      `
      *,
      empresas ( id, nombre ),
      representantes ( id, nombre, apellido )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })

  if (representanteId) {
    q = q.eq("representante_id", Number(representanteId))
  }
  if (empresaId) {
    q = q.eq("empresa_id", Number(empresaId))
  }
  if (estadoValidacion && ["VALIDADO", "PENDIENTE_VALIDAR"].includes(estadoValidacion)) {
    q = q.eq("estado_validacion", estadoValidacion)
  }

  if (search) {
    const s = `%${search}%`
    q = q.or(`nombre.ilike.${s},apellido.ilike.${s},cedula.ilike.${s}`)
  }

  const { data, error, count } = await q.range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    data: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
  })
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

  const parsed = clienteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const payload = {
    nombre: parsed.data.nombre.trim(),
    apellido: parsed.data.apellido.trim(),
    cedula: parsed.data.cedula.trim(),
    ubicacion: parsed.data.ubicacion.trim(),
    telefono: parsed.data.telefono.trim(),
    estado_validacion: parsed.data.estadoValidacion ?? "VALIDADO",
    representante_id: parsed.data.representanteId,
    empresa_id: parsed.data.empresaId,
  }

  const { data, error } = await supabase.from("clientes").insert(payload).select().single()

  if (error) {
    if (error.code === "23505") {
      return badRequest("Ya existe un cliente con esa cédula")
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
