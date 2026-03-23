import { NextResponse } from "next/server"
import {
  badRequest,
  getUserAndRole,
  unauthorized,
} from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { clienteCreateSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select(
      `
      *,
      empresas ( id, nombre ),
      representantes ( id, nombre, apellido, telefono, email )
    `,
    )
    .eq("id", id)
    .single()

  if (error || !cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  }

  const { data: prestamos } = await supabase
    .from("prestamos")
    .select("*")
    .eq("cliente_id", id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ ...cliente, prestamos: prestamos ?? [] })
}

export async function PUT(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

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

  const { data, error } = await supabase.from("clientes").update(payload).eq("id", id).select().single()

  if (error) {
    if (error.code === "23505") {
      return badRequest("Ya existe un cliente con esa cédula")
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  const { data: activos } = await supabase
    .from("prestamos")
    .select("id")
    .eq("cliente_id", id)
    .in("estado", ["ACTIVO", "MORA"])

  if (activos && activos.length > 0) {
    return badRequest("No se puede eliminar: el cliente tiene préstamos activos o en mora")
  }

  const { error } = await supabase.from("clientes").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
