import { NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import * as XLSX from "xlsx"
import Decimal from "decimal.js"
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { reportesQuerySchema } from "@/lib/validations/schemas"

// ── Layout constants ──────────────────────────────────────────────────────────
const PW = 210          // page width mm
const PH = 297          // page height mm
const ML = 14           // left/right margin
const CW = PW - ML * 2  // content width = 182mm
const FOOTER_Y = PH - 13

// ── Color palette ─────────────────────────────────────────────────────────────
type RGB = [number, number, number]
const C: Record<string, RGB> = {
  headerBg:   [30,  27,  75],
  white:      [255, 255, 255],
  headerSub:  [199, 210, 254],
  accent:     [79,  70,  229],
  tblHead:    [79,  70,  229],
  tblAlt:     [238, 242, 255],
  border:     [209, 213, 219],
  moraHead:   [153, 27,  27],
  moraRowA:   [254, 242, 242],
  moraRowB:   [254, 226, 226],
  totalBg:    [224, 231, 255],
  totalTxt:   [49,  46,  129],
  kpiBg:      [249, 250, 251],
  kpiBorder:  [224, 231, 255],
  body:       [17,  24,  39],
  muted:      [107, 114, 128],
  sectionBg:  [30,  27,  75],
  green:      [5,   150, 105],
  amber:      [180, 83,  9],
  red:        [185, 28,  28],
  gray:       [107, 114, 128],
}

function sf(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]) }
function sd(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]) }
function st(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]) }

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtRD(v: unknown): string {
  const n = Number(v ?? 0)
  if (Number.isNaN(n)) return "RD$0.00"
  return new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(s: unknown): string {
  if (!s) return "—"
  const str = String(s).slice(0, 10)
  const d = new Date(`${str}T12:00:00`)
  if (Number.isNaN(d.getTime())) return str
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function diasAtraso(fechaVence: string | null | undefined): number {
  if (!fechaVence) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const v = new Date(`${String(fechaVence).slice(0, 10)}T12:00:00`); v.setHours(0, 0, 0, 0)
  const diff = hoy.getTime() - v.getTime()
  return diff > 0 ? Math.floor(diff / 86400000) : 0
}

// ── Page header (first page) ──────────────────────────────────────────────────
function drawPageHeader(
  doc: jsPDF,
  userName: string,
  now: Date,
  filters: { fechaDesde?: string; fechaHasta?: string },
): number {
  const H = 38
  sf(doc, C.headerBg); doc.rect(0, 0, PW, H, "F")

  // Logo circle
  sf(doc, C.accent); doc.circle(ML + 9, H / 2, 8, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(9)
  st(doc, C.white)
  doc.text("MP", ML + 9, H / 2 + 1.2, { align: "center" })

  // Company name
  doc.setFont("helvetica", "bold"); doc.setFontSize(17)
  st(doc, C.white)
  doc.text("Préstamos Elicar", ML + 22, H / 2 - 2.5)

  // Subtitle
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
  st(doc, C.headerSub)
  doc.text("Microfinanzas y Soluciones Crediticias", ML + 22, H / 2 + 5.5)

  // Right metadata
  const nowStr = now.toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
  doc.setFontSize(8); st(doc, C.headerSub)
  let ry = H / 2 - 7.5
  doc.text(`Generado: ${nowStr}`, PW - ML, ry, { align: "right" }); ry += 5.5
  doc.text(`Usuario: ${userName}`, PW - ML, ry, { align: "right" }); ry += 5.5
  if (filters.fechaDesde || filters.fechaHasta) {
    const desde = filters.fechaDesde ? fmtDate(filters.fechaDesde) : "Inicio"
    const hasta = filters.fechaHasta ? fmtDate(filters.fechaHasta) : "Hoy"
    doc.text(`Período: ${desde} — ${hasta}`, PW - ML, ry, { align: "right" })
  }

  // Accent divider
  sf(doc, C.accent); doc.rect(0, H, PW, 3, "F")
  return H + 3
}

// ── Mini header for continuation pages ───────────────────────────────────────
function drawMiniHeader(doc: jsPDF): number {
  sf(doc, C.headerBg); doc.rect(0, 0, PW, 16, "F")
  sf(doc, C.accent);   doc.rect(0, 16, PW, 2, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); st(doc, C.white)
  doc.text("Préstamos Elicar", ML, 11)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(doc, C.headerSub)
  doc.text("Microfinanzas y Soluciones Crediticias — continuación", PW - ML, 11, { align: "right" })
  return 22
}

// ── KPI cards (2 rows × 3 cards) ─────────────────────────────────────────────
function drawKPIs(doc: jsPDF, startY: number, kpis: {
  totalPrestado: string; totalCobrado: string; totalPendiente: string
  activos: number; mora: number; clientes: number
}): number {
  let y = startY + 7
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); st(doc, C.sectionBg)
  doc.text("RESUMEN EJECUTIVO", ML, y)
  y += 5

  const gap = 4
  const cardW = (CW - gap * 2) / 3
  const cardH = 23

  const items = [
    { label: "Total Prestado",     value: fmtRD(kpis.totalPrestado),   color: C.accent },
    { label: "Total Cobrado",      value: fmtRD(kpis.totalCobrado),    color: C.green  },
    { label: "Balance Pendiente",  value: fmtRD(kpis.totalPendiente),  color: C.amber  },
    { label: "Préstamos Activos",  value: String(kpis.activos),         color: C.accent },
    { label: "Préstamos Vencidos", value: String(kpis.mora),            color: C.red    },
    { label: "Total Clientes",     value: String(kpis.clientes),        color: C.gray   },
  ]

  for (let i = 0; i < items.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = ML + col * (cardW + gap)
    const cy = y + row * (cardH + gap)

    sf(doc, C.kpiBg)
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F")
    sf(doc, items[i].color)
    doc.rect(cx, cy, 3.5, cardH, "F")
    sd(doc, C.kpiBorder); doc.setLineWidth(0.2)
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "S")

    doc.setFont("helvetica", "bold"); doc.setFontSize(12)
    st(doc, items[i].color)
    doc.text(items[i].value, cx + cardW / 2, cy + 12.5, { align: "center" })

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
    st(doc, C.muted)
    doc.text(items[i].label, cx + cardW / 2, cy + 19, { align: "center" })
  }

  return y + 2 * (cardH + gap) + 3
}

// ── Generic table section ─────────────────────────────────────────────────────
interface ColDef {
  header: string
  key: string
  w: number
  align?: "left" | "right" | "center"
  fmt?: (v: unknown) => string
}

function drawSection(
  doc: jsPDF,
  startY: number,
  title: string,
  badge: string,
  cols: ColDef[],
  rows: Record<string, unknown>[],
  totalRow: Record<string, unknown> | null,
  opts: { warningMode?: boolean; addPage: () => number },
): number {
  const { warningMode = false, addPage } = opts
  const ROW_H = 7
  let y = startY + 7

  if (y + 35 > FOOTER_Y) y = addPage()

  // ── Section title bar ──
  sf(doc, warningMode ? C.moraHead : C.sectionBg)
  doc.rect(ML, y - 5.5, CW, 10, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); st(doc, C.white)
  doc.text(title, ML + 3, y + 0.5)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
  st(doc, C.headerSub)
  doc.text(badge, PW - ML - 3, y + 0.5, { align: "right" })
  y += 6

  // ── Column header row ──
  sf(doc, warningMode ? [220, 38, 38] as RGB : C.tblHead)
  doc.rect(ML, y, CW, ROW_H, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); st(doc, C.white)
  let cx = ML
  for (const col of cols) {
    const tx = col.align === "right" ? cx + col.w - 2
              : col.align === "center" ? cx + col.w / 2 : cx + 2
    doc.text(col.header, tx, y + 4.8, {
      align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
    })
    cx += col.w
  }
  y += ROW_H

  // ── Data rows ──
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)

  for (let i = 0; i < rows.length; i++) {
    if (y + ROW_H > FOOTER_Y) y = addPage()

    const alt = i % 2 === 1
    sf(doc, warningMode ? (alt ? C.moraRowB : C.moraRowA) : (alt ? C.tblAlt : C.white))
    doc.rect(ML, y, CW, ROW_H, "F")
    sd(doc, C.border); doc.setLineWidth(0.1)
    doc.line(ML, y + ROW_H, ML + CW, y + ROW_H)

    st(doc, C.body)
    cx = ML
    for (const col of cols) {
      const val = rows[i][col.key]
      const text = col.fmt ? col.fmt(val) : (val == null ? "—" : String(val))
      const tx = col.align === "right" ? cx + col.w - 2
                : col.align === "center" ? cx + col.w / 2 : cx + 2
      doc.text(text, tx, y + 4.8, {
        align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
        maxWidth: col.w - 3,
      })
      cx += col.w
    }
    y += ROW_H
  }

  // ── Totals row ──
  if (totalRow) {
    if (y + ROW_H + 2 > FOOTER_Y) y = addPage()
    sf(doc, C.totalBg); doc.rect(ML, y, CW, ROW_H + 1, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, C.totalTxt)
    cx = ML
    for (const col of cols) {
      const val = totalRow[col.key]
      if (val != null) {
        const text = col.fmt ? col.fmt(val) : String(val)
        const tx = col.align === "right" ? cx + col.w - 2
                  : col.align === "center" ? cx + col.w / 2 : cx + 2
        doc.text(text, tx, y + 5.3, {
          align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
        })
      }
      cx += col.w
    }
    y += ROW_H + 1
  }

  return y
}

// ── Footer on every page ──────────────────────────────────────────────────────
function stampFooters(doc: jsPDF, now: Date) {
  const total = doc.getNumberOfPages()
  const dateStr = now.toLocaleDateString("es-DO", {
    day: "2-digit", month: "long", year: "numeric",
  })
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    sd(doc, C.border); doc.setLineWidth(0.3)
    doc.line(ML, FOOTER_Y - 2, PW - ML, FOOTER_Y - 2)
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); st(doc, C.muted)
    const fy = FOOTER_Y + 3
    doc.text("Documento Confidencial — Préstamos Elicar. Uso interno exclusivo.", ML, fy)
    doc.text(dateStr, PW / 2, fy, { align: "center" })
    doc.text(`Página ${p} de ${total}`, PW - ML, fy, { align: "right" })
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const formato = searchParams.get("formato") || "pdf"

  const parsed = reportesQuerySchema.safeParse({
    empresaId:        searchParams.get("empresaId")        || undefined,
    representanteId:  searchParams.get("representanteId")  || undefined,
    clienteId:        searchParams.get("clienteId")        || undefined,
    estado:           searchParams.get("estado")           || undefined,
    fechaDesde:       searchParams.get("fechaDesde")       || undefined,
    fechaHasta:       searchParams.get("fechaHasta")       || undefined,
  })
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Parámetros inválidos")

  const f = parsed.data

  // User info for header
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null }
  const userName: string = (profile as { full_name?: string } | null)?.full_name || user?.email || "Sistema"

  // Fetch prestamos
  let q = supabase.from("prestamos").select(`
    *,
    clientes (
      id, nombre, apellido, cedula, telefono,
      empresa_id, representante_id,
      empresas ( nombre ),
      representantes ( nombre, apellido )
    )
  `)
  if (f.clienteId)  q = q.eq("cliente_id", f.clienteId)
  if (f.estado)     q = q.eq("estado", f.estado)
  if (f.fechaDesde) q = q.gte("fecha_inicio", f.fechaDesde)
  if (f.fechaHasta) q = q.lte("fecha_inicio", f.fechaHasta)

  const { data: prestamos, error } = await q.order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let rows = prestamos ?? []
  if (f.empresaId) {
    rows = rows.filter((p) => (p.clientes as { empresa_id?: number })?.empresa_id === f.empresaId)
  }
  if (f.representanteId) {
    rows = rows.filter(
      (p) => (p.clientes as { representante_id?: number })?.representante_id === f.representanteId,
    )
  }

  // ── Flatten rows ──────────────────────────────────────────────────────────
  type FlatRow = {
    id: number; cliente: string; cedula: string; empresa: string; telefono: string
    monto: string; capital_pendiente: string; estado: string
    fecha_inicio: string; fecha_proximo_vencimiento: string
    tasa_interes: string; plazo: number
  }

  const flat: FlatRow[] = rows.map((p) => {
    const c = p.clientes as {
      nombre?: string; apellido?: string; cedula?: string; telefono?: string
      empresas?: { nombre?: string }; representantes?: { nombre?: string; apellido?: string }
    }
    return {
      id: p.id as number,
      cliente: `${c?.nombre ?? ""} ${c?.apellido ?? ""}`.trim() || "—",
      cedula: c?.cedula ?? "—",
      empresa: c?.empresas?.nombre ?? "—",
      telefono: c?.telefono ?? "—",
      monto: String(p.monto ?? "0"),
      capital_pendiente: String(p.capital_pendiente ?? "0"),
      estado: String(p.estado ?? ""),
      fecha_inicio: String(p.fecha_inicio ?? ""),
      fecha_proximo_vencimiento: String(p.fecha_proximo_vencimiento ?? ""),
      tasa_interes: String(p.tasa_interes ?? "0"),
      plazo: Number(p.plazo ?? 0),
    }
  })

  // ── Excel export (unchanged logic, better column names) ────────────────────
  if (formato === "excel") {
    const sheet = XLSX.utils.json_to_sheet(
      flat.map((r) => ({
        "ID":             r.id,
        "Cliente":        r.cliente,
        "Cédula":         r.cedula,
        "Empresa":        r.empresa,
        "Monto Original": Number(r.monto),
        "Capital Pendiente": Number(r.capital_pendiente),
        "Tasa (%)":       Number(r.tasa_interes),
        "Plazo":          r.plazo,
        "Estado":         r.estado,
        "Fecha Inicio":   r.fecha_inicio,
        "Próx. Vencimiento": r.fecha_proximo_vencimiento,
      })),
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, "Préstamos Elicar")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="prestamos-elicar-reporte-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  }

  // ── Compute KPIs ───────────────────────────────────────────────────────────
  const activos = flat.filter((r) => r.estado === "ACTIVO")
  const mora    = flat.filter((r) => r.estado === "MORA")

  let totalPrestado  = new Decimal(0)
  let totalPendiente = new Decimal(0)
  const clientesSet  = new Set<string>()

  for (const r of flat) {
    totalPrestado = totalPrestado.plus(r.monto)
    if (r.estado !== "SALDADO") {
      totalPendiente = totalPendiente.plus(r.capital_pendiente)
      clientesSet.add(r.cedula !== "—" ? r.cedula : String(r.id))
    }
  }
  const totalCobrado = Decimal.max(new Decimal(0), totalPrestado.minus(totalPendiente))

  // Clients with pending balance — grouped, sorted desc by saldo
  const cliMap = new Map<string, { cliente: string; telefono: string; empresa: string; saldo: Decimal }>()
  for (const r of flat) {
    if (r.estado === "SALDADO") continue
    const key = r.cedula !== "—" ? r.cedula : r.cliente
    const ex = cliMap.get(key)
    if (ex) {
      ex.saldo = ex.saldo.plus(r.capital_pendiente)
    } else {
      cliMap.set(key, { cliente: r.cliente, telefono: r.telefono, empresa: r.empresa, saldo: new Decimal(r.capital_pendiente) })
    }
  }
  const clientesSaldo = [...cliMap.values()]
    .sort((a, b) => b.saldo.cmp(a.saldo))
    .map((c) => ({ ...c, saldo: c.saldo.toFixed(2) }))

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const now = new Date()

  let y = drawPageHeader(doc, userName, now, { fechaDesde: f.fechaDesde, fechaHasta: f.fechaHasta })

  const addPage = (): number => {
    doc.addPage()
    return drawMiniHeader(doc)
  }

  y = drawKPIs(doc, y, {
    totalPrestado:  totalPrestado.toFixed(2),
    totalCobrado:   totalCobrado.toFixed(2),
    totalPendiente: totalPendiente.toFixed(2),
    activos:        activos.length,
    mora:           mora.length,
    clientes:       clientesSaldo.length,
  })

  // ── ACTIVOS table ──────────────────────────────────────────────────────────
  // Column widths sum = 182
  const colsActivos: ColDef[] = [
    { header: "#",           key: "num",                       w: 8,  align: "center" },
    { header: "Cliente",     key: "cliente",                   w: 42, align: "left"   },
    { header: "Cédula",      key: "cedula",                    w: 30, align: "left"   },
    { header: "Monto Orig.", key: "monto",                     w: 28, align: "right",  fmt: fmtRD },
    { header: "Cap. Pend.",  key: "capital_pendiente",         w: 30, align: "right",  fmt: fmtRD },
    { header: "Tasa",        key: "tasa_interes",              w: 14, align: "center", fmt: (v) => `${v}%` },
    { header: "Próx. Vto.",  key: "fecha_proximo_vencimiento", w: 30, align: "center", fmt: fmtDate },
  ]
  const activosRows = activos.map((r, i) => ({ ...r, num: i + 1 })) as Record<string, unknown>[]
  const sumActivoMonto = activos.reduce((s, r) => s.plus(r.monto), new Decimal(0))
  const sumActivoPend  = activos.reduce((s, r) => s.plus(r.capital_pendiente), new Decimal(0))

  y = drawSection(
    doc, y,
    `PRÉSTAMOS ACTIVOS (${activos.length})`,
    `Prestado: ${fmtRD(sumActivoMonto.toFixed(2))}  |  Pendiente: ${fmtRD(sumActivoPend.toFixed(2))}`,
    colsActivos,
    activosRows,
    {
      num: null, cliente: `TOTALES — ${activos.length} préstamos`, cedula: null,
      monto: sumActivoMonto.toFixed(2),
      capital_pendiente: sumActivoPend.toFixed(2),
      tasa_interes: null, fecha_proximo_vencimiento: null,
    },
    { warningMode: false, addPage },
  )

  // ── MORA table ────────────────────────────────────────────────────────────
  if (mora.length > 0) {
    // Column widths sum = 182
    const colsMora: ColDef[] = [
      { header: "#",           key: "num",                       w: 8,  align: "center" },
      { header: "Cliente",     key: "cliente",                   w: 42, align: "left"   },
      { header: "Cédula",      key: "cedula",                    w: 30, align: "left"   },
      { header: "Monto Orig.", key: "monto",                     w: 28, align: "right",  fmt: fmtRD },
      { header: "Cap. Pend.",  key: "capital_pendiente",         w: 30, align: "right",  fmt: fmtRD },
      { header: "Días Atraso", key: "dias",                      w: 18, align: "center", fmt: (v) => typeof v === "number" ? `${v} días` : String(v ?? "—") },
      { header: "Fecha Venc.", key: "fecha_proximo_vencimiento", w: 26, align: "center", fmt: fmtDate },
    ]
    const moraRows = mora.map((r, i) => ({
      ...r,
      num: i + 1,
      dias: diasAtraso(r.fecha_proximo_vencimiento),
    })) as Record<string, unknown>[]

    const sumMoraMonto = mora.reduce((s, r) => s.plus(r.monto), new Decimal(0))
    const sumMoraPend  = mora.reduce((s, r) => s.plus(r.capital_pendiente), new Decimal(0))
    const avgDias = Math.round(
      (moraRows.reduce((s, r) => s + (r.dias as number), 0)) / (mora.length || 1),
    )

    y = drawSection(
      doc, y,
      `PRÉSTAMOS VENCIDOS / MORA (${mora.length})`,
      `Pendiente: ${fmtRD(sumMoraPend.toFixed(2))}  |  Prom. atraso: ${avgDias} días`,
      colsMora,
      moraRows,
      {
        num: null, cliente: `TOTALES — ${mora.length} préstamos en mora`, cedula: null,
        monto: sumMoraMonto.toFixed(2),
        capital_pendiente: sumMoraPend.toFixed(2),
        dias: `~${avgDias} días (prom.)`,
        fecha_proximo_vencimiento: null,
      },
      { warningMode: true, addPage },
    )
  }

  // ── CLIENTES CON SALDO table ───────────────────────────────────────────────
  if (clientesSaldo.length > 0) {
    // Column widths sum = 182
    const colsCli: ColDef[] = [
      { header: "#",               key: "num",      w: 10, align: "center" },
      { header: "Cliente",         key: "cliente",  w: 55, align: "left"   },
      { header: "Teléfono",        key: "telefono", w: 35, align: "left"   },
      { header: "Empresa",         key: "empresa",  w: 42, align: "left"   },
      { header: "Saldo Pendiente", key: "saldo",    w: 40, align: "right",  fmt: fmtRD },
    ]
    const cliRows = clientesSaldo.map((c, i) => ({ ...c, num: i + 1 })) as Record<string, unknown>[]
    const totalSaldo = clientesSaldo.reduce((s, c) => s.plus(c.saldo), new Decimal(0))

    y = drawSection(
      doc, y,
      `CLIENTES CON SALDO PENDIENTE (${clientesSaldo.length})`,
      `Total: ${fmtRD(totalSaldo.toFixed(2))}`,
      colsCli,
      cliRows,
      {
        num: null,
        cliente: `TOTAL — ${clientesSaldo.length} clientes`,
        telefono: null, empresa: null,
        saldo: totalSaldo.toFixed(2),
      },
      { warningMode: false, addPage },
    )
  }

  stampFooters(doc, now)

  doc.setProperties({
    title:   "Reporte General — Préstamos Elicar",
    subject: "Microfinanzas y Soluciones Crediticias",
    author:  "Préstamos Elicar",
    creator: "Préstamos Elicar",
  })

  const buf = doc.output("arraybuffer")
  const today = now.toISOString().slice(0, 10)
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prestamos-elicar-reporte-general-${today}.pdf"`,
    },
  })
}
