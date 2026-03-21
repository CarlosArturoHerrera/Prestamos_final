import { NextResponse } from "next/server"
import {
  badRequest,
  forbidden,
  getUserAndRole,
  requireAdmin,
  unauthorized,
} from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { representanteCreateSchema } from "@/lib/validations/schemas"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()
  if (!requireAdmin(session.role)) return forbidden()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("JSON inválido")
  }

  const parsed = representanteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const payload = {
    nombre: parsed.data.nombre.trim(),
    apellido: parsed.data.apellido.trim(),
    telefono: parsed.data.telefono.trim(),
    email: parsed.data.email.trim().toLowerCase(),
  }

  const { data, error } = await supabase.from("representantes").update(payload).eq("id", id).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()
  if (!requireAdmin(session.role)) return forbidden()

  const { id: idParam } = await ctx.params
  const id = Number(idParam)
  if (!Number.isFinite(id)) return badRequest("ID inválido")

  const { count, error: cErr } = await supabase
    .from("clientes")
    .select("*", { count: "exact", head: true })
    .eq("representante_id", id)

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 400 })
  }

  if ((count ?? 0) > 0) {
    return badRequest("No se puede eliminar: hay clientes asignados a este representante")
  }

  const { error } = await supabase.from("representantes").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
