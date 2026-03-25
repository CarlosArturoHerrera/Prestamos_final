import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { empresaCreateSchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))
  const search = (searchParams.get("search") || searchParams.get("q") || "").trim()
  const conRnc = searchParams.get("conRnc") === "true"
  const sinRnc = searchParams.get("sinRnc") === "true"

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from("empresas").select("*", { count: "exact" }).order("nombre", { ascending: true })

  if (search) {
    const s = `%${search}%`
    query = query.or(`nombre.ilike.${s},rnc.ilike.${s},email.ilike.${s}`)
  }
  if (sinRnc) {
    query = query.is("rnc", null)
  } else if (conRnc) {
    query = query.not("rnc", "is", null)
  }

  const { data, error, count } = await query.range(from, to)

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

  const parsed = empresaCreateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Validación fallida")
  }

  const payload = {
    nombre: parsed.data.nombre.trim(),
    rnc: parsed.data.rnc?.trim() || null,
    direccion: parsed.data.direccion?.trim() || null,
    telefono: parsed.data.telefono?.trim() || null,
    email: parsed.data.email?.trim() || null,
  }

  const { data, error } = await supabase.from("empresas").insert(payload).select().single()

  if (error) {
    if (error.code === "23505") {
      return badRequest("Ya existe una empresa con ese nombre")
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
