import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const representanteId = searchParams.get("representanteId")
  const fechaDesde = searchParams.get("fechaDesde")
  const fechaHasta = searchParams.get("fechaHasta")
  const canal = searchParams.get("canal")

  let q = supabase
    .from("notificaciones")
    .select(
      `
      *,
      representantes ( id, nombre, apellido, telefono, email )
    `,
    )
    .order("fecha_envio", { ascending: false })

  if (representanteId) {
    q = q.eq("representante_id", Number(representanteId))
  }
  if (fechaDesde) {
    q = q.gte("fecha_envio", `${fechaDesde}T00:00:00`)
  }
  if (fechaHasta) {
    q = q.lte("fecha_envio", `${fechaHasta}T23:59:59`)
  }
  if (canal && ["WHATSAPP", "EMAIL", "AMBOS"].includes(canal)) {
    q = q.eq("canal", canal)
  }

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data: data ?? [] })
}
