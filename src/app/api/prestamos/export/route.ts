import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getUserAndRole, unauthorized } from "@/lib/api-auth"
import {
  createPrestamosListQuery,
  enrichPrestamoListRowsWithFlags,
  mapPrestamoListRowFromRaw,
  resolvePrestamosListPreFilters,
} from "@/lib/prestamos-list-query"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const MAX_EXPORT_ROWS = 8000
const CHUNK = 500

function formatRDPlain(n: string | number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return String(n)
  return x.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const formato = (searchParams.get("format") || "csv").toLowerCase()
  if (formato !== "csv" && formato !== "xlsx") {
    return NextResponse.json({ error: "format debe ser csv o xlsx" }, { status: 400 })
  }

  const clienteId = searchParams.get("clienteId")
  const estado = searchParams.get("estado")
  const qText = (searchParams.get("q") || "").trim()
  const conInteresPendiente = searchParams.get("conInteresPendiente") === "true"

  const pre = await resolvePrestamosListPreFilters(supabase, qText, conInteresPendiente)
  if (pre.empty) {
    return emptyExport(formato)
  }

  const lista: Record<string, unknown>[] = []
  for (let from = 0; from < MAX_EXPORT_ROWS; from += CHUNK) {
    const q = createPrestamosListQuery(supabase, pre, { clienteId, estado })
    const { data, error } = await q.range(from, from + CHUNK - 1)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const chunk = data ?? []
    if (chunk.length === 0) break
    lista.push(...(chunk as Record<string, unknown>[]))
    if (chunk.length < CHUNK) break
  }

  const rowsBase = lista.map((raw) => mapPrestamoListRowFromRaw(raw))
  const rows = await enrichPrestamoListRowsWithFlags(supabase, rowsBase)

  const flat = rows.map((r) => {
    const rr = r as Record<string, unknown>
    const cli = rr.clientes as
      | {
          nombre?: string
          apellido?: string
          cedula?: string
          empresas?: { nombre?: string }
          representantes?: { nombre?: string; apellido?: string }
        }
      | null
      | undefined
    const rep = cli?.representantes
      ? `${cli.representantes.nombre ?? ""} ${cli.representantes.apellido ?? ""}`.trim()
      : ""
    return {
      id: rr.id,
      cliente: cli ? `${cli.nombre ?? ""} ${cli.apellido ?? ""}`.trim() : "",
      cedula: cli?.cedula ?? "",
      empresa: cli?.empresas?.nombre ?? "",
      representante: rep,
      monto_original: formatRDPlain(rr.monto as string | number),
      capital_pendiente: formatRDPlain(rr.capital_pendiente as string | number),
      estado: rr.estado,
      tasa_pct: String(rr.tasa_interes),
      fecha_proximo_vencimiento: rr.fecha_proximo_vencimiento,
      interes_proxima_cuota: formatRDPlain(rr.interes_proximo as string),
      capital_debitar_proximo: formatRDPlain(rr.capital_debitar_proximo as string),
      total_proximo_pago: formatRDPlain(rr.total_proximo_pago as string),
      abonos_realizados: rr.abonos_realizados,
      interes_pendiente_historico: rr.tiene_interes_pendiente ? "Sí" : "No",
      capitalizacion_auto_en_historial: rr.tiene_capitalizacion_auto ? "Sí" : "No",
      capitalizacion_manual_en_historial: rr.tiene_capitalizacion_manual ? "Sí" : "No",
    }
  })

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const baseName = `prestamos_${stamp}`

  if (formato === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(flat)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Préstamos")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    })
  }

  const ws = XLSX.utils.json_to_sheet(flat)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const bom = "\uFEFF"
  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  })
}

function emptyExport(formato: string) {
  const flat: Record<string, string>[] = []
  const ws = XLSX.utils.json_to_sheet(flat)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const baseName = `prestamos_${stamp}`
  if (formato === "xlsx") {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Préstamos")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    })
  }
  return new NextResponse("\uFEFF", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  })
}
