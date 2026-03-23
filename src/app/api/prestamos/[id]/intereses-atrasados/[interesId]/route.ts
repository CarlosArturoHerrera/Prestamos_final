import { NextResponse } from "next/server"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type Ctx = { params: Promise<{ id: string; interesId: string }> }

export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { id: idParam, interesId: interesIdParam } = await ctx.params
  const id = Number(idParam)
  const interesId = Number(interesIdParam)
  if (!Number.isFinite(id) || !Number.isFinite(interesId)) {
    return badRequest("ID inválido")
  }

  const { error } = await supabase
    .from("intereses_atrasados")
    .delete()
    .eq("id", interesId)
    .eq("prestamo_id", id)
    .eq("aplicado", false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
