import { NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import * as XLSX from "xlsx"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { reportesQuerySchema } from "@/lib/validations/schemas"

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const formato = searchParams.get("formato") || "pdf"

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
        empresas ( nombre ),
        representantes ( nombre, apellido )
      )
    `,
  )

  if (f.clienteId) q = q.eq("cliente_id", f.clienteId)
  if (f.estado) q = q.eq("estado", f.estado)
  if (f.fechaDesde) q = q.gte("fecha_inicio", f.fechaDesde)
  if (f.fechaHasta) q = q.lte("fecha_inicio", f.fechaHasta)

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

  const flat = rows.map((p) => {
    const c = p.clientes as {
      nombre?: string
      apellido?: string
      cedula?: string
      empresas?: { nombre?: string }
      representantes?: { nombre?: string; apellido?: string }
    }
    return {
      id: p.id,
      cliente: `${c?.nombre ?? ""} ${c?.apellido ?? ""}`.trim(),
      cedula: c?.cedula ?? "",
      empresa: c?.empresas?.nombre ?? "",
      representante: `${c?.representantes?.nombre ?? ""} ${c?.representantes?.apellido ?? ""}`.trim(),
      monto: p.monto,
      capital_pendiente: p.capital_pendiente,
      estado: p.estado,
      fecha_inicio: p.fecha_inicio,
      fecha_proximo_vencimiento: p.fecha_proximo_vencimiento,
    }
  })

  if (formato === "excel") {
    const sheet = XLSX.utils.json_to_sheet(flat)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, "Cartera")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="reporte-cartera.xlsx"',
      },
    })
  }

  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text("Reporte de cartera", 14, 18)
  doc.setFontSize(10)
  let y = 28
  for (const r of flat.slice(0, 40)) {
    const line = `#${r.id} ${r.cliente} | ${r.estado} | RD$ ${r.capital_pendiente} | Vence ${r.fecha_proximo_vencimiento}`
    doc.text(line.substring(0, 120), 14, y)
    y += 6
    if (y > 280) {
      doc.addPage()
      y = 20
    }
  }
  const buf = doc.output("arraybuffer")
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="reporte-cartera.pdf"',
    },
  })
}
