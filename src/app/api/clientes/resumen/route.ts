import { NextResponse } from "next/server"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** Totales de clientes para panel operativo (sin filtros de listado). */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const [{ count: total }, { count: validados }, { count: pendientes }] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado_validacion", "VALIDADO"),
    supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("estado_validacion", "PENDIENTE_VALIDAR"),
  ])

  return NextResponse.json({
    total: total ?? 0,
    validados: validados ?? 0,
    pendientesValidacion: pendientes ?? 0,
  })
}
