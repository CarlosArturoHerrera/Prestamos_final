import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { representanteCreateSchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))
  const search = (searchParams.get("search") || "").trim()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from("representantes")
    .select("*", { count: "exact" })
    .order("apellido", { ascending: true })

  if (search) {
    const s = `%${search}%`
    q = q.or(`nombre.ilike.${s},apellido.ilike.${s},email.ilike.${s},telefono.ilike.${s}`)
  }

  const { data: reps, error, count } = await q.range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const list = reps ?? []

  const ids = list.map((r) => r.id)
  const counts: Record<number, number> = {}
  if (ids.length) {
    const { data: agg } = await supabase.from("clientes").select("representante_id").in("representante_id", ids)
    for (const row of agg ?? []) {
      const k = row.representante_id as number
      counts[k] = (counts[k] ?? 0) + 1
    }
  }

  const data = list.map((r) => ({
    ...r,
    clientes_asignados: counts[r.id] ?? 0,
  }))

  return NextResponse.json({
    data,
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

  const { data, error } = await supabase.from("representantes").insert(payload).select().single()

  if (error) {
    if (error.code === "23505") {
      return badRequest("Ya existe un representante con ese email")
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
