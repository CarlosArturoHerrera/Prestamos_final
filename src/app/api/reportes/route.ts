import { NextResponse } from "next/server"
import Decimal from "decimal.js"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { reportesQuerySchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const parsed = reportesQuerySchema.safeParse({
    empresaId: searchParams.get("empresaId") || undefined,
    representanteId: searchParams.get("representanteId") || undefined,
    clienteId: searchParams.get("clienteId") || undefined,
    estado: searchParams.get("estado") || undefined,
    fechaDesde: searchParams.get("fechaDesde") || undefined,
    fechaHasta: searchParams.get("fechaHasta") || undefined,
  })

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Parámetros inválidos")
  }

  const f = parsed.data

  let q = supabase.from("prestamos").select(
    `
      *,
      clientes (
        id, nombre, apellido, cedula,
        empresa_id, representante_id,
        empresas ( id, nombre ),
        representantes ( id, nombre, apellido )
      )
    `,
  )

  if (f.clienteId) {
    q = q.eq("cliente_id", f.clienteId)
  }
  if (f.estado) {
    q = q.eq("estado", f.estado)
  }
  if (f.fechaDesde) {
    q = q.gte("fecha_inicio", f.fechaDesde)
  }
  if (f.fechaHasta) {
    q = q.lte("fecha_inicio", f.fechaHasta)
  }

  const { data: prestamos, error } = await q.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  let rows = prestamos ?? []

  if (f.empresaId) {
    rows = rows.filter((p) => (p.clientes as { empresa_id?: number })?.empresa_id === f.empresaId)
  }
  if (f.representanteId) {
    rows = rows.filter(
      (p) => (p.clientes as { representante_id?: number })?.representante_id === f.representanteId,
    )
  }

  let totalPrestado = new Decimal(0)
  let totalPendiente = new Decimal(0)
  let totalMora = new Decimal(0)
  const clientesSet = new Set<number>()

  for (const p of rows) {
    totalPrestado = totalPrestado.plus(String(p.monto))
    totalPendiente = totalPendiente.plus(String(p.capital_pendiente))
    if (p.estado === "MORA") {
      totalMora = totalMora.plus(String(p.capital_pendiente))
    }
    const cid = (p.clientes as { id: number })?.id
    if (cid && p.estado === "ACTIVO") {
      clientesSet.add(cid)
    }
  }

  return NextResponse.json({
    kpis: {
      total_prestado: totalPrestado.toFixed(2),
      total_pendiente: totalPendiente.toFixed(2),
      total_en_mora: totalMora.toFixed(2),
      clientes_activos: clientesSet.size,
    },
    data: rows,
  })
}
