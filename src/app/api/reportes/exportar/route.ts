import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Decimal from "decimal.js";
import { jsPDF } from "jspdf";
import { NextResponse } from "next/server";
import { badRequest, getUserAndRole, unauthorized } from "@/lib/api-auth";
import { formatCedula, formatPhone } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportesQuerySchema } from "@/lib/validations/schemas";

// ── Shared layout / color constants ──────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;
const CW = PAGE_W - ML * 2;
const FOOTER_Y = PAGE_H - 13;

type RGB = [number, number, number];
// Paleta suave y de bajo contraste (Stripe/Notion/Vercel) con identidad Elicar.
// Superficies claras, texto slate, azules apagados; nada saturado ni fluorescente.
const C: Record<string, RGB> = {
  white: [255, 255, 255],
  text: [30, 41, 59], // #1E293B texto principal
  muted: [100, 116, 139], // #64748B texto secundario
  border: [226, 232, 240], // #E2E8F0
  borderSoft: [241, 245, 249], // #F1F5F9 separadores discretos
  bgSoft: [248, 250, 252], // #F8FAFC
  brand: [0, 82, 204], // #0052CC (solo logo)
  brand2: [37, 99, 235], // #2563EB (acentos finos)
  lightBlue: [96, 165, 250], // #60A5FA
  accent: [0, 210, 255], // #00D2FF (degradado)
  tblHeadBg: [239, 244, 255], // #EFF4FF azul muy suave
  tblHeadTxt: [30, 41, 59], // texto oscuro sobre header claro
  rowAlt: [248, 250, 252], // #F8FAFC fila par
  sectBg: [241, 245, 249], // #F1F5F9 barra de sección clara
  sectTxt: [30, 41, 59],
  totalBg: [239, 244, 255], // #EFF4FF
  totalTxt: [30, 58, 138], // #1E3A8A azul elegante
  kpiBg: [248, 250, 252], // #F8FAFC
  kpiBorder: [226, 232, 240], // #E2E8F0
  blue: [37, 99, 235], // estado activo (azul suave)
  green: [4, 120, 87], // #047857 verde elegante
  amber: [180, 83, 9], // #B45309
  orange: [194, 65, 12], // #C2410C mora (naranja desaturado)
  gray: [100, 116, 139], // #64748B
  warnBg: [254, 242, 242], // #FEF2F2 barra mora clara
  warnTxt: [154, 52, 18], // #9A3412 texto mora legible
  warnHeadBg: [255, 237, 226], // #FFEDE2 header tabla mora
  warnRowAlt: [254, 247, 244], // #FEF7F4 fila par mora
  warnAccent: [194, 65, 12], // #C2410C
};
function sf(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function sd(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
function st(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}

// ── Shared formatters ─────────────────────────────────────────────────────────
function fmtRD(v: unknown): string {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "RD$0.00";
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
function fmtDate(s: unknown): string {
  if (!s) return "—";
  const str = String(s).slice(0, 10);
  const d = new Date(`${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function diasAtraso(fechaVence: string | null | undefined): number {
  if (!fechaVence) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const v = new Date(`${String(fechaVence).slice(0, 10)}T12:00:00`);
  v.setHours(0, 0, 0, 0);
  const diff = hoy.getTime() - v.getTime();
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
}
function colLetter(n: number): string {
  return String.fromCharCode(64 + n); // works for 1-26
}

// ── Logo del proyecto (public/logo.png) en base64, cacheado por proceso ───────
// undefined = aún no intentado · null = no se pudo leer (usa chip de respaldo)
let logoCache: string | null | undefined;
async function getLogoBase64(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const buf = await readFile(join(process.cwd(), "public", "logo.png"));
    logoCache = buf.toString("base64");
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

// Línea divisoria con degradado azul muy sutil (lightBlue → accent).
function gradientLine(doc: jsPDF, x: number, y: number, w: number, h = 0.8) {
  const steps = 60;
  const seg = w / steps;
  const a = C.lightBlue;
  const b = C.accent;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    sf(doc, [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ]);
    doc.rect(x + i * seg, y, seg + 0.35, h, "F");
  }
}

function drawPageHeader(
  doc: jsPDF,
  userName: string,
  now: Date,
  filters: { fechaDesde?: string; fechaHasta?: string },
  logo: string | null,
): number {
  const H = 38;
  // Logo del proyecto (o chip de respaldo si no se pudo cargar)
  if (logo) {
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", ML, 11, 15, 15);
  } else {
    sf(doc, C.brand);
    doc.roundedRect(ML, 12, 13, 13, 2.6, 2.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    st(doc, C.white);
    doc.text("PE", ML + 6.5, 19.9, { align: "center" });
  }
  // Nombre del sistema + subtítulo (texto oscuro sobre blanco)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  st(doc, C.text);
  doc.text("Préstamos Elicar", ML + 18, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  st(doc, C.muted);
  doc.text("Microfinanzas y Soluciones Crediticias", ML + 18, 22.5);
  // Metadatos (fecha / usuario / período) alineados a la derecha
  const nowStr = now.toLocaleString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFontSize(8);
  st(doc, C.muted);
  let ry = 14;
  doc.text(`Generado: ${nowStr}`, PAGE_W - ML, ry, { align: "right" });
  ry += 5;
  doc.text(`Usuario: ${userName}`, PAGE_W - ML, ry, { align: "right" });
  ry += 5;
  if (filters.fechaDesde || filters.fechaHasta) {
    const desde = filters.fechaDesde ? fmtDate(filters.fechaDesde) : "Inicio";
    const hasta = filters.fechaHasta ? fmtDate(filters.fechaHasta) : "Hoy";
    doc.text(`Período: ${desde} — ${hasta}`, PAGE_W - ML, ry, {
      align: "right",
    });
  }
  // Divisor degradado
  gradientLine(doc, ML, H, CW);
  return H + 3;
}
function drawMiniHeader(doc: jsPDF, logo: string | null): number {
  if (logo) {
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", ML, 3.5, 9, 9);
  } else {
    sf(doc, C.brand);
    doc.roundedRect(ML, 5, 8, 8, 1.8, 1.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    st(doc, C.white);
    doc.text("PE", ML + 4, 9.7, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  st(doc, C.text);
  doc.text("Préstamos Elicar", ML + 11, 10.7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  st(doc, C.muted);
  doc.text(
    "Microfinanzas y Soluciones Crediticias — continuación",
    PAGE_W - ML,
    10.7,
    { align: "right" },
  );
  gradientLine(doc, ML, 15, CW, 0.7);
  return 22;
}
function drawKPIs(
  doc: jsPDF,
  startY: number,
  kpis: {
    totalPrestado: string;
    totalCobrado: string;
    totalPendiente: string;
    activos: number;
    mora: number;
    clientes: number;
  },
): number {
  let y = startY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  st(doc, C.text);
  doc.text("RESUMEN EJECUTIVO", ML, y);
  sf(doc, C.brand2);
  doc.rect(ML, y + 1.8, 28, 0.6, "F");
  y += 5;
  const gap = 4;
  const cardW = (CW - gap * 2) / 3;
  const cardH = 23;
  const items = [
    {
      label: "Total Prestado",
      value: fmtRD(kpis.totalPrestado),
      color: C.brand2,
    },
    { label: "Total Cobrado", value: fmtRD(kpis.totalCobrado), color: C.green },
    {
      label: "Balance Pendiente",
      value: fmtRD(kpis.totalPendiente),
      color: C.amber,
    },
    {
      label: "Préstamos Activos",
      value: String(kpis.activos),
      color: C.blue,
    },
    { label: "Préstamos Vencidos", value: String(kpis.mora), color: C.orange },
    { label: "Total Clientes", value: String(kpis.clientes), color: C.gray },
  ];
  for (let i = 0; i < items.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = ML + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    // Tarjeta: fondo gris muy claro, borde suave, acento lateral + ícono
    sf(doc, C.kpiBg);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");
    sd(doc, C.kpiBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "S");
    sf(doc, items[i].color);
    doc.rect(cx, cy, 2.4, cardH, "F");
    doc.circle(cx + cardW / 2, cy + 5, 1.4, "F");
    // Valor grande (oscuro) + título pequeño (secundario)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    st(doc, C.text);
    doc.text(items[i].value, cx + cardW / 2, cy + 13.2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    st(doc, C.muted);
    doc.text(items[i].label, cx + cardW / 2, cy + 19, { align: "center" });
  }
  return y + 2 * (cardH + gap) + 3;
}
interface ColDef {
  header: string;
  key: string;
  w: number;
  align?: "left" | "right" | "center";
  fmt?: (v: unknown) => string;
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
  const { warningMode = false, addPage } = opts;
  const ROW_H = 7;
  let y = startY + 7;
  if (y + 35 > FOOTER_Y) y = addPage();
  const sectBg = warningMode ? C.warnBg : C.sectBg;
  const sectTxt = warningMode ? C.warnTxt : C.sectTxt;
  const accent = warningMode ? C.warnAccent : C.brand2;
  const headBg = warningMode ? C.warnHeadBg : C.tblHeadBg;
  const headTxt = warningMode ? C.warnTxt : C.tblHeadTxt;
  const altRow = warningMode ? C.warnRowAlt : C.rowAlt;
  // Barra de sección clara con acento lateral (sin encabezados pesados)
  sf(doc, sectBg);
  doc.rect(ML, y - 5.5, CW, 10, "F");
  sf(doc, accent);
  doc.rect(ML, y - 5.5, 1.6, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  st(doc, sectTxt);
  doc.text(title, ML + 4, y + 0.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  st(doc, C.muted);
  doc.text(badge, PAGE_W - ML - 3, y + 0.5, { align: "right" });
  y += 6;
  // Encabezado de columnas: azul muy suave, texto oscuro
  sf(doc, headBg);
  doc.rect(ML, y, CW, ROW_H, "F");
  sd(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  st(doc, headTxt);
  let cx = ML;
  for (const col of cols) {
    const tx =
      col.align === "right"
        ? cx + col.w - 2
        : col.align === "center"
          ? cx + col.w / 2
          : cx + 2;
    doc.text(col.header, tx, y + 4.8, {
      align:
        col.align === "right"
          ? "right"
          : col.align === "center"
            ? "center"
            : "left",
    });
    cx += col.w;
  }
  y += ROW_H;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  for (let i = 0; i < rows.length; i++) {
    if (y + ROW_H > FOOTER_Y) y = addPage();
    const alt = i % 2 === 1;
    sf(doc, alt ? altRow : C.white);
    doc.rect(ML, y, CW, ROW_H, "F");
    sd(doc, C.borderSoft);
    doc.setLineWidth(0.1);
    doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);
    st(doc, C.text);
    cx = ML;
    for (const col of cols) {
      const val = rows[i][col.key];
      const text = col.fmt ? col.fmt(val) : val == null ? "—" : String(val);
      const tx =
        col.align === "right"
          ? cx + col.w - 2
          : col.align === "center"
            ? cx + col.w / 2
            : cx + 2;
      doc.text(text, tx, y + 4.8, {
        align:
          col.align === "right"
            ? "right"
            : col.align === "center"
              ? "center"
              : "left",
        maxWidth: col.w - 3,
      });
      cx += col.w;
    }
    y += ROW_H;
  }
  if (totalRow) {
    if (y + ROW_H + 2 > FOOTER_Y) y = addPage();
    sf(doc, C.totalBg);
    doc.rect(ML, y, CW, ROW_H + 1, "F");
    sd(doc, accent);
    doc.setLineWidth(0.4);
    doc.line(ML, y, ML + CW, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    st(doc, warningMode ? C.warnTxt : C.totalTxt);
    cx = ML;
    for (const col of cols) {
      const val = totalRow[col.key];
      if (val != null) {
        const text = col.fmt ? col.fmt(val) : String(val);
        const tx =
          col.align === "right"
            ? cx + col.w - 2
            : col.align === "center"
              ? cx + col.w / 2
              : cx + 2;
        doc.text(text, tx, y + 5.3, {
          align:
            col.align === "right"
              ? "right"
              : col.align === "center"
                ? "center"
                : "left",
        });
      }
      cx += col.w;
    }
    y += ROW_H + 1;
  }
  return y;
}
function stampFooters(doc: jsPDF, now: Date) {
  const total = doc.getNumberOfPages();
  const dateStr = now.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    sd(doc, C.border);
    doc.setLineWidth(0.3);
    doc.line(ML, FOOTER_Y - 2, PAGE_W - ML, FOOTER_Y - 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    st(doc, C.muted);
    const fy = FOOTER_Y + 3;
    doc.text(
      "Documento Confidencial — Préstamos Elicar. Uso interno exclusivo.",
      ML,
      fy,
    );
    doc.text(dateStr, PAGE_W / 2, fy, { align: "center" });
    doc.text(`Página ${p} de ${total}`, PAGE_W - ML, fy, { align: "right" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL GENERATION (exceljs — styled)
// ═══════════════════════════════════════════════════════════════════════════

// Misma identidad suave que el PDF: superficies claras, texto slate, azules apagados.
const XL = {
  white: "FFFFFFFF",
  text: "FF1E293B", // texto principal
  muted: "FF64748B", // texto secundario
  border: "FFE2E8F0",
  borderSoft: "FFF1F5F9",
  bgSoft: "FFF8FAFC",
  brand2: "FF2563EB", // acentos finos
  lightBlue: "FF60A5FA",
  accent: "FF00D2FF",
  tblHeadBg: "FFEFF4FF", // azul muy suave
  tblHeadTx: "FF1E293B", // texto oscuro
  rowAlt: "FFF8FAFC", // fila par
  totBg: "FFEFF4FF",
  totTx: "FF1E3A8A", // azul elegante
  sectBg: "FFF1F5F9",
  sectTx: "FF1E293B",
  kpiBg: "FFF8FAFC",
  kpiBdr: "FFE2E8F0",
  blue: "FF2563EB",
  green: "FF047857",
  amber: "FFB45309",
  orange: "FFC2410C",
  gray: "FF64748B",
  warnBg: "FFFEF2F2",
  warnTx: "FF9A3412",
  warnHead: "FFFFEDE2",
  warnRow: "FFFEF7F4",
  warnAcc: "FFC2410C",
  infoBg: "FFEFF4FF",
  infoTx: "FF1E3A8A",
};
// biome-ignore lint: any needed for exceljs dynamic shape
function xFill(argb: string): any {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
// biome-ignore lint: any needed for exceljs dynamic shape
function xFont(opts: {
  bold?: boolean;
  size?: number;
  color?: string;
  italic?: boolean;
}): any {
  return {
    name: "Calibri",
    bold: opts.bold ?? false,
    size: opts.size ?? 11,
    italic: opts.italic ?? false,
    ...(opts.color ? { color: { argb: opts.color } } : {}),
  };
}
// biome-ignore lint: any needed for exceljs dynamic shape
function xBorder(c = XL.border): any {
  const s = { style: "thin", color: { argb: c } };
  return { top: s, left: s, bottom: s, right: s };
}
// biome-ignore lint: any needed for exceljs dynamic shape
function xAlign(h: "left" | "right" | "center" = "left", indent = 0): any {
  return { vertical: "middle", horizontal: h, indent };
}
// biome-ignore lint: any needed for exceljs cell
function xCell(
  sheet: any,
  ref: string,
  opts: {
    value?: unknown;
    fill?: string;
    font?: any;
    align?: any;
    border?: any;
    numFmt?: string;
  },
) {
  const cell = sheet.getCell(ref);
  if (opts.value !== undefined) cell.value = opts.value;
  if (opts.fill) cell.fill = xFill(opts.fill);
  if (opts.font) cell.font = opts.font;
  if (opts.align) cell.alignment = opts.align;
  if (opts.border) cell.border = opts.border;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}
// biome-ignore lint: any needed for exceljs sheet
function xMerge(
  sheet: any,
  range: string,
  opts: {
    value?: unknown;
    fill?: string;
    font?: any;
    align?: any;
    border?: any;
    numFmt?: string;
  },
) {
  sheet.mergeCells(range);
  const topLeft = range.split(":")[0];
  xCell(sheet, topLeft, opts);
}

// biome-ignore lint: any needed for exceljs gradient fill
function xGradient(from: string, to: string): any {
  return {
    type: "gradient",
    gradient: "angle",
    degree: 0,
    stops: [
      { position: 0, color: { argb: from } },
      { position: 1, color: { argb: to } },
    ],
  };
}

// biome-ignore lint: any needed for exceljs sheet
function xlHeader(
  sheet: any,
  numCols: number,
  reportTitle: string,
  userName: string,
  nowStr: string,
  filters: { fechaDesde?: string; fechaHasta?: string },
  logoId: number | null,
): number {
  const L = colLetter(numCols);
  // Encabezado corporativo: fondo blanco, texto oscuro.
  // Si hay logo, se indenta el título/subtítulo para dejar espacio al logotipo.
  const withLogo = logoId != null;
  const ind = withLogo ? 8 : 2;
  sheet.getRow(1).height = withLogo ? 36 : 30;
  xMerge(sheet, `A1:${L}1`, {
    value: "Préstamos Elicar",
    fill: XL.white,
    font: xFont({ bold: true, size: 18, color: XL.text }),
    align: xAlign("left", ind),
  });
  sheet.getRow(2).height = 18;
  xMerge(sheet, `A2:${L}2`, {
    value: "Microfinanzas y Soluciones Crediticias",
    fill: XL.white,
    font: xFont({ size: 10, color: XL.muted }),
    align: xAlign("left", ind),
  });
  sheet.getRow(3).height = 22;
  xMerge(sheet, `A3:${L}3`, {
    value: reportTitle,
    fill: XL.sectBg,
    font: xFont({ bold: true, size: 11, color: XL.sectTx }),
    align: xAlign("center"),
  });
  sheet.getRow(4).height = 16;
  let info = `Generado: ${nowStr}  •  Usuario: ${userName}`;
  if (filters.fechaDesde || filters.fechaHasta) {
    const desde = filters.fechaDesde ? fmtDate(filters.fechaDesde) : "Inicio";
    const hasta = filters.fechaHasta ? fmtDate(filters.fechaHasta) : "Hoy";
    info += `  •  Período: ${desde} — ${hasta}`;
  }
  xMerge(sheet, `A4:${L}4`, {
    value: info,
    fill: XL.bgSoft,
    font: xFont({ size: 9, color: XL.muted }),
    align: xAlign("left", 1),
  });
  // Logo del proyecto flotando en la esquina superior izquierda (letterhead)
  if (logoId != null) {
    sheet.addImage(logoId, {
      tl: { col: 0.12, row: 0.12 },
      ext: { width: 40, height: 40 },
    });
  }
  // Línea divisoria con degradado azul muy sutil
  sheet.getRow(5).height = 5;
  sheet.mergeCells(`A5:${L}5`);
  sheet.getCell("A5").fill = xGradient(XL.lightBlue, XL.accent);
  return 5;
}

// biome-ignore lint: any needed for exceljs sheet
function xlFooter(sheet: any, row: number, numCols: number, dateStr: string) {
  const L = colLetter(numCols);
  sheet.getRow(row).height = 8;
  xMerge(sheet, `A${row}:${L}${row}`, { value: "", fill: XL.white });
  sheet.getRow(row + 1).height = 14;
  xMerge(sheet, `A${row + 1}:${L}${row + 1}`, {
    value: `Documento Confidencial — Préstamos Elicar. Uso interno exclusivo.  •  ${dateStr}`,
    fill: XL.bgSoft,
    font: xFont({ size: 8, italic: true, color: XL.muted }),
    align: xAlign("center"),
  });
}

interface XlCol {
  header: string;
  key: string;
  width: number;
  align?: "left" | "right" | "center";
  fmt?: string;
}

// biome-ignore lint: any needed for exceljs sheet
function xlTable(
  sheet: any,
  startRow: number,
  numCols: number,
  title: string,
  cols: XlCol[],
  rows: Record<string, unknown>[],
  totals: Record<string, unknown> | null,
  opts: { warningMode?: boolean } = {},
): number {
  const { warningMode = false } = opts;
  const L = colLetter(numCols);
  let row = startRow;

  const sectBg = warningMode ? XL.warnBg : XL.sectBg;
  const sectTx = warningMode ? XL.warnTx : XL.sectTx;
  const headBg = warningMode ? XL.warnHead : XL.tblHeadBg;
  const headTx = warningMode ? XL.warnTx : XL.tblHeadTx;
  const accent = warningMode ? XL.warnAcc : XL.brand2;

  // Barra de sección (clara, acento lateral)
  sheet.getRow(row).height = 20;
  xMerge(sheet, `A${row}:${L}${row}`, {
    value: title,
    fill: sectBg,
    font: xFont({ bold: true, size: 11, color: sectTx }),
    align: xAlign("left", 2),
    border: { left: { style: "medium", color: { argb: accent } } },
  });
  row++;

  // Encabezados de columna (azul muy suave, texto oscuro)
  sheet.getRow(row).height = 20;
  for (let j = 0; j < cols.length; j++) {
    xCell(sheet, `${colLetter(j + 1)}${row}`, {
      value: cols[j].header,
      fill: headBg,
      font: xFont({ bold: true, size: 10, color: headTx }),
      align: xAlign(cols[j].align ?? "left", cols[j].align !== "right" ? 1 : 0),
      border: xBorder(XL.border),
    });
  }
  // biome-ignore lint: dynamic property for autoFilter
  sheet.autoFilter = { from: `A${row}`, to: `${L}${row}` };
  row++;

  // Filas de datos (alternancia blanco / #F8FAFC, separadores discretos)
  for (let i = 0; i < rows.length; i++) {
    const alt = i % 2 === 1;
    const bg = warningMode
      ? alt
        ? XL.warnRow
        : XL.white
      : alt
        ? XL.rowAlt
        : XL.white;
    sheet.getRow(row).height = 18;

    for (let j = 0; j < cols.length; j++) {
      const col = cols[j];
      const val = rows[i][col.key];
      const cell = sheet.getCell(`${colLetter(j + 1)}${row}`);
      cell.fill = xFill(bg);
      cell.font = xFont({ size: 10, color: XL.text });
      cell.alignment = xAlign(
        col.align ?? "left",
        col.align !== "right" ? 1 : 0,
      );
      cell.border = {
        bottom: { style: "thin", color: { argb: XL.border } },
        right: { style: "thin", color: { argb: XL.borderSoft } },
      };
      if (col.fmt && val != null && !Number.isNaN(Number(val))) {
        cell.value = Number(val);
        cell.numFmt = col.fmt;
      } else {
        cell.value = val != null ? String(val) : "—";
      }
    }
    row++;
  }

  // Fila de totales
  if (totals) {
    sheet.getRow(row).height = 20;
    for (let j = 0; j < cols.length; j++) {
      const col = cols[j];
      const val = totals[col.key];
      const cell = sheet.getCell(`${colLetter(j + 1)}${row}`);
      cell.fill = xFill(warningMode ? XL.warnBg : XL.totBg);
      cell.font = xFont({
        bold: true,
        size: 10,
        color: warningMode ? XL.warnTx : XL.totTx,
      });
      cell.alignment = xAlign(
        col.align ?? "left",
        col.align !== "right" ? 1 : 0,
      );
      cell.border = {
        top: { style: "medium", color: { argb: accent } },
        bottom: { style: "thin", color: { argb: XL.border } },
        right: { style: "thin", color: { argb: XL.borderSoft } },
      };
      if (val == null) {
        cell.value = "";
      } else if (col.fmt && !Number.isNaN(Number(val))) {
        cell.value = Number(val);
        cell.numFmt = col.fmt;
      } else {
        cell.value = String(val);
      }
    }
    row++;
  }
  return row;
}

// biome-ignore lint: any needed for exceljs workbook
function xlKpis(
  sheet: any,
  startRow: number,
  numCols: number,
  kpis: {
    totalPrestado: string;
    totalCobrado: string;
    totalPendiente: string;
    activos: number;
    mora: number;
    clientes: number;
  },
): number {
  const L = colLetter(numCols);
  let row = startRow + 1;

  // RESUMEN EJECUTIVO title (suave, acento lateral)
  sheet.getRow(row).height = 20;
  xMerge(sheet, `A${row}:${L}${row}`, {
    value: "RESUMEN EJECUTIVO",
    fill: XL.sectBg,
    font: xFont({ bold: true, size: 11, color: XL.sectTx }),
    align: xAlign("left", 2),
    border: { left: { style: "medium", color: { argb: XL.brand2 } } },
  });
  row++;

  // Spacer
  sheet.getRow(row).height = 6;
  xMerge(sheet, `A${row}:${L}${row}`, { value: "", fill: XL.white });
  row++;

  // KPI data: 3 per row, 2 rows total → 6 cols used as A:B / C:D / E:F
  const kpiRows = [
    [
      {
        label: "Total Prestado",
        value: fmtRD(kpis.totalPrestado),
        color: XL.brand2,
      },
      {
        label: "Total Cobrado",
        value: fmtRD(kpis.totalCobrado),
        color: XL.green,
      },
      {
        label: "Balance Pendiente",
        value: fmtRD(kpis.totalPendiente),
        color: XL.amber,
      },
    ],
    [
      {
        label: "Préstamos Activos",
        value: String(kpis.activos),
        color: XL.blue,
      },
      {
        label: "Préstamos Vencidos",
        value: String(kpis.mora),
        color: XL.orange,
      },
      { label: "Total Clientes", value: String(kpis.clientes), color: XL.gray },
    ],
  ];
  const kpiCols = [
    [1, 2],
    [3, 4],
    [5, 6],
  ]; // each KPI spans 2 columns

  for (const items of kpiRows) {
    sheet.getRow(row).height = 16; // label row
    sheet.getRow(row + 1).height = 30; // value row

    for (let i = 0; i < items.length; i++) {
      const [c1, c2] = kpiCols[i];
      const item = items[i];
      const r1 = `${colLetter(c1)}${row}:${colLetter(c2)}${row}`;
      const r2 = `${colLetter(c1)}${row + 1}:${colLetter(c2)}${row + 1}`;

      xMerge(sheet, r1, {
        value: item.label,
        fill: XL.kpiBg,
        font: xFont({ size: 9, color: XL.muted }),
        align: { vertical: "bottom", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: XL.kpiBdr } },
          right: { style: "thin", color: { argb: XL.kpiBdr } },
          left: { style: "medium", color: { argb: item.color } },
        },
      });
      xMerge(sheet, r2, {
        value: item.value,
        fill: XL.kpiBg,
        font: xFont({ bold: true, size: 14, color: XL.text }),
        align: { vertical: "middle", horizontal: "center" },
        border: {
          bottom: { style: "thin", color: { argb: XL.kpiBdr } },
          right: { style: "thin", color: { argb: XL.kpiBdr } },
          left: { style: "medium", color: { argb: item.color } },
        },
      });
    }
    row += 2;

    // Gap between KPI rows
    sheet.getRow(row).height = 8;
    xMerge(sheet, `A${row}:${L}${row}`, { value: "", fill: XL.white });
    row++;
  }
  return row;
}

type FlatRow = {
  id: number;
  cliente: string;
  cedula: string;
  empresa: string;
  telefono: string;
  monto: string;
  capital_pendiente: string;
  estado: string;
  fecha_inicio: string;
  fecha_proximo_vencimiento: string;
  tasa_interes: string;
  plazo: number;
};
type ClienteSaldo = {
  cliente: string;
  telefono: string;
  empresa: string;
  saldo: string;
};

async function generateExcel(params: {
  activos: FlatRow[];
  mora: FlatRow[];
  clientesSaldo: ClienteSaldo[];
  kpis: {
    totalPrestado: string;
    totalCobrado: string;
    totalPendiente: string;
    activos: number;
    mora: number;
    clientes: number;
  };
  userName: string;
  now: Date;
  filters: { fechaDesde?: string; fechaHasta?: string };
  logo: string | null;
}): Promise<Buffer> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "Préstamos Elicar";
  wb.created = params.now;
  wb.modified = params.now;
  const logoId = params.logo
    ? wb.addImage({ base64: params.logo, extension: "png" })
    : null;

  const nowStr = params.now.toLocaleString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = params.now.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const sumActivoMonto = params.activos.reduce(
    (s, r) => s.plus(r.monto),
    new Decimal(0),
  );
  const sumActivoPend = params.activos.reduce(
    (s, r) => s.plus(r.capital_pendiente),
    new Decimal(0),
  );
  const sumMoraMonto = params.mora.reduce(
    (s, r) => s.plus(r.monto),
    new Decimal(0),
  );
  const sumMoraPend = params.mora.reduce(
    (s, r) => s.plus(r.capital_pendiente),
    new Decimal(0),
  );
  const avgDias =
    params.mora.length > 0
      ? Math.round(
          params.mora.reduce(
            (s, r) => s + diasAtraso(r.fecha_proximo_vencimiento),
            0,
          ) / params.mora.length,
        )
      : 0;
  const totalSaldoCli = params.clientesSaldo.reduce(
    (s, c) => s.plus(c.saldo),
    new Decimal(0),
  );

  // ── Hoja 1: Resumen Ejecutivo ────────────────────────────────────────────
  const shRes = wb.addWorksheet("Resumen Ejecutivo", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  for (let i = 1; i <= 6; i++) shRes.getColumn(i).width = 20;
  let y = xlHeader(
    shRes,
    6,
    "REPORTE GENERAL DEL SISTEMA",
    params.userName,
    nowStr,
    params.filters,
    logoId,
  );
  y = xlKpis(shRes, y, 6, params.kpis);
  shRes.getRow(y).height = 16;
  xMerge(shRes, `A${y}:F${y}`, {
    value:
      "Ver hojas: Préstamos Activos • Préstamos Mora • Clientes para el detalle completo.",
    fill: XL.infoBg,
    font: xFont({ size: 9, color: XL.infoTx }),
    align: xAlign("left", 1),
  });
  y++;
  xlFooter(shRes, y, 6, dateStr);

  // ── Hoja 2: Préstamos Activos ─────────────────────────────────────────────
  const shAct = wb.addWorksheet("Préstamos Activos", {
    views: [{ state: "frozen", ySplit: 7 }],
  });
  [5, 28, 18, 18, 18, 8, 14].forEach((w, i) => {
    shAct.getColumn(i + 1).width = w;
  });
  y = xlHeader(
    shAct,
    7,
    "PRÉSTAMOS ACTIVOS",
    params.userName,
    nowStr,
    params.filters,
    logoId,
  );
  y++;
  const colsAct: XlCol[] = [
    { header: "#", key: "num", width: 5, align: "center" },
    { header: "Cliente", key: "cliente", width: 28, align: "left" },
    { header: "Cédula", key: "cedula", width: 18, align: "left" },
    {
      header: "Monto Orig.",
      key: "monto",
      width: 18,
      align: "right",
      fmt: '"RD$"#,##0.00',
    },
    {
      header: "Cap. Pend.",
      key: "cap",
      width: 18,
      align: "right",
      fmt: '"RD$"#,##0.00',
    },
    { header: "Tasa %", key: "tasa", width: 8, align: "center" },
    { header: "Próx. Vto.", key: "vto", width: 14, align: "center" },
  ];
  const actRows = params.activos.map((r, i) => ({
    num: i + 1,
    cliente: r.cliente,
    cedula: formatCedula(r.cedula),
    monto: Number(r.monto),
    cap: Number(r.capital_pendiente),
    tasa: `${r.tasa_interes}%`,
    vto: fmtDate(r.fecha_proximo_vencimiento),
  })) as Record<string, unknown>[];
  y = xlTable(
    shAct,
    y,
    7,
    `PRÉSTAMOS ACTIVOS (${params.activos.length})`,
    colsAct,
    actRows,
    {
      num: null,
      cliente: `TOTALES — ${params.activos.length} préstamos`,
      cedula: null,
      monto: sumActivoMonto.toNumber(),
      cap: sumActivoPend.toNumber(),
      tasa: null,
      vto: null,
    },
  );
  xlFooter(shAct, y, 7, dateStr);

  // ── Hoja 3: Préstamos Mora ────────────────────────────────────────────────
  const shMora = wb.addWorksheet("Préstamos Mora", {
    views: [{ state: "frozen", ySplit: 7 }],
    properties: { tabColor: { argb: XL.warnAcc } },
  });
  [5, 28, 18, 18, 18, 12, 14].forEach((w, i) => {
    shMora.getColumn(i + 1).width = w;
  });
  y = xlHeader(
    shMora,
    7,
    "PRÉSTAMOS VENCIDOS / MORA",
    params.userName,
    nowStr,
    params.filters,
    logoId,
  );
  y++;
  const colsMora: XlCol[] = [
    { header: "#", key: "num", width: 5, align: "center" },
    { header: "Cliente", key: "cliente", width: 28, align: "left" },
    { header: "Cédula", key: "cedula", width: 18, align: "left" },
    {
      header: "Monto Orig.",
      key: "monto",
      width: 18,
      align: "right",
      fmt: '"RD$"#,##0.00',
    },
    {
      header: "Cap. Pend.",
      key: "cap",
      width: 18,
      align: "right",
      fmt: '"RD$"#,##0.00',
    },
    { header: "Días Atraso", key: "dias", width: 12, align: "center" },
    { header: "Fecha Venc.", key: "vto", width: 14, align: "center" },
  ];
  const moraRows = params.mora.map((r, i) => ({
    num: i + 1,
    cliente: r.cliente,
    cedula: formatCedula(r.cedula),
    monto: Number(r.monto),
    cap: Number(r.capital_pendiente),
    dias: `${diasAtraso(r.fecha_proximo_vencimiento)} días`,
    vto: fmtDate(r.fecha_proximo_vencimiento),
  })) as Record<string, unknown>[];
  y = xlTable(
    shMora,
    y,
    7,
    `PRÉSTAMOS VENCIDOS / MORA (${params.mora.length})`,
    colsMora,
    moraRows,
    {
      num: null,
      cliente: `TOTALES — ${params.mora.length} préstamos en mora`,
      cedula: null,
      monto: sumMoraMonto.toNumber(),
      cap: sumMoraPend.toNumber(),
      dias: `~${avgDias} días (prom.)`,
      vto: null,
    },
    { warningMode: true },
  );
  xlFooter(shMora, y, 7, dateStr);

  // ── Hoja 4: Clientes con Saldo ────────────────────────────────────────────
  const shCli = wb.addWorksheet("Clientes", {
    views: [{ state: "frozen", ySplit: 7 }],
  });
  [5, 30, 18, 25, 20].forEach((w, i) => {
    shCli.getColumn(i + 1).width = w;
  });
  y = xlHeader(
    shCli,
    5,
    "CLIENTES CON SALDO PENDIENTE",
    params.userName,
    nowStr,
    params.filters,
    logoId,
  );
  y++;
  const colsCli: XlCol[] = [
    { header: "#", key: "num", width: 5, align: "center" },
    { header: "Cliente", key: "cliente", width: 30, align: "left" },
    { header: "Teléfono", key: "telefono", width: 18, align: "left" },
    { header: "Empresa", key: "empresa", width: 25, align: "left" },
    {
      header: "Saldo Pendiente",
      key: "saldo",
      width: 20,
      align: "right",
      fmt: '"RD$"#,##0.00',
    },
  ];
  const cliRows = params.clientesSaldo.map((c, i) => ({
    num: i + 1,
    cliente: c.cliente,
    telefono: formatPhone(c.telefono),
    empresa: c.empresa,
    saldo: Number(c.saldo),
  })) as Record<string, unknown>[];
  y = xlTable(
    shCli,
    y,
    5,
    `CLIENTES CON SALDO PENDIENTE (${params.clientesSaldo.length})`,
    colsCli,
    cliRows,
    {
      num: null,
      cliente: `TOTAL — ${params.clientesSaldo.length} clientes`,
      telefono: null,
      empresa: null,
      saldo: totalSaldoCli.toNumber(),
    },
  );
  xlFooter(shCli, y, 5, dateStr);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const formato = searchParams.get("formato") || "pdf";

  const parsed = reportesQuerySchema.safeParse({
    empresaId: searchParams.get("empresaId") || undefined,
    representanteId: searchParams.get("representanteId") || undefined,
    clienteId: searchParams.get("clienteId") || undefined,
    estado: searchParams.get("estado") || undefined,
    fechaDesde: searchParams.get("fechaDesde") || undefined,
    fechaHasta: searchParams.get("fechaHasta") || undefined,
  });
  if (!parsed.success)
    return badRequest(
      parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    );
  const f = parsed.data;

  // User info for headers
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const userName: string =
    (profile as { full_name?: string } | null)?.full_name ||
    user?.email ||
    "Sistema";

  // Fetch prestamos
  let q = supabase.from("prestamos").select(`
    *, clientes (
      id, nombre, apellido, cedula, telefono,
      empresa_id, representante_id,
      empresas ( nombre ), representantes ( nombre, apellido )
    )
  `);
  if (f.clienteId) q = q.eq("cliente_id", f.clienteId);
  if (f.estado) q = q.eq("estado", f.estado);
  if (f.fechaDesde) q = q.gte("fecha_inicio", f.fechaDesde);
  if (f.fechaHasta) q = q.lte("fecha_inicio", f.fechaHasta);

  const { data: prestamos, error } = await q.order("created_at", {
    ascending: false,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  let rows = prestamos ?? [];
  if (f.empresaId)
    rows = rows.filter(
      (p) =>
        (p.clientes as { empresa_id?: number })?.empresa_id === f.empresaId,
    );
  if (f.representanteId)
    rows = rows.filter(
      (p) =>
        (p.clientes as { representante_id?: number })?.representante_id ===
        f.representanteId,
    );

  // Flatten
  const flat: FlatRow[] = rows.map((p) => {
    const c = p.clientes as {
      nombre?: string;
      apellido?: string;
      cedula?: string;
      telefono?: string;
      empresas?: { nombre?: string };
      representantes?: { nombre?: string; apellido?: string };
    };
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
    };
  });

  const activos = flat.filter((r) => r.estado === "ACTIVO");
  const mora = flat.filter((r) => r.estado === "MORA");

  let totalPrestado = new Decimal(0);
  let totalPendiente = new Decimal(0);
  const clientesSet = new Set<string>();
  for (const r of flat) {
    totalPrestado = totalPrestado.plus(r.monto);
    if (r.estado !== "SALDADO") {
      totalPendiente = totalPendiente.plus(r.capital_pendiente);
      clientesSet.add(r.cedula !== "—" ? r.cedula : String(r.id));
    }
  }
  const totalCobrado = Decimal.max(
    new Decimal(0),
    totalPrestado.minus(totalPendiente),
  );

  // Clients with pending balance
  const cliMap = new Map<string, ClienteSaldo & { saldoD: Decimal }>();
  for (const r of flat) {
    if (r.estado === "SALDADO") continue;
    const key = r.cedula !== "—" ? r.cedula : r.cliente;
    const ex = cliMap.get(key);
    if (ex) {
      ex.saldoD = ex.saldoD.plus(r.capital_pendiente);
    } else {
      cliMap.set(key, {
        cliente: r.cliente,
        telefono: r.telefono,
        empresa: r.empresa,
        saldo: r.capital_pendiente,
        saldoD: new Decimal(r.capital_pendiente),
      });
    }
  }
  const clientesSaldo: ClienteSaldo[] = [...cliMap.values()]
    .sort((a, b) => b.saldoD.cmp(a.saldoD))
    .map((c) => ({
      cliente: c.cliente,
      telefono: c.telefono,
      empresa: c.empresa,
      saldo: c.saldoD.toFixed(2),
    }));

  const kpis = {
    totalPrestado: totalPrestado.toFixed(2),
    totalCobrado: totalCobrado.toFixed(2),
    totalPendiente: totalPendiente.toFixed(2),
    activos: activos.length,
    mora: mora.length,
    clientes: clientesSaldo.length,
  };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const filters = { fechaDesde: f.fechaDesde, fechaHasta: f.fechaHasta };
  const logo = await getLogoBase64();

  // ── Excel ────────────────────────────────────────────────────────────────
  if (formato === "excel") {
    const excelBuf = await generateExcel({
      activos,
      mora,
      clientesSaldo,
      kpis,
      userName,
      now,
      filters,
      logo,
    });
    return new NextResponse(excelBuf.buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="prestamos-elicar-reporte-${today}.xlsx"`,
      },
    });
  }

  // ── PDF ──────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const addPage = (): number => {
    doc.addPage();
    return drawMiniHeader(doc, logo);
  };

  let y = drawPageHeader(doc, userName, now, filters, logo);
  y = drawKPIs(doc, y, kpis);

  const colsAct: ColDef[] = [
    { header: "#", key: "num", w: 8, align: "center" },
    { header: "Cliente", key: "cliente", w: 42, align: "left" },
    { header: "Cédula", key: "cedula", w: 30, align: "left" },
    { header: "Monto Orig.", key: "monto", w: 28, align: "right", fmt: fmtRD },
    {
      header: "Cap. Pend.",
      key: "capital_pendiente",
      w: 30,
      align: "right",
      fmt: fmtRD,
    },
    {
      header: "Tasa",
      key: "tasa_interes",
      w: 14,
      align: "center",
      fmt: (v) => `${v}%`,
    },
    {
      header: "Próx. Vto.",
      key: "fecha_proximo_vencimiento",
      w: 30,
      align: "center",
      fmt: fmtDate,
    },
  ];
  const sumAM = activos.reduce((s, r) => s.plus(r.monto), new Decimal(0));
  const sumAP = activos.reduce(
    (s, r) => s.plus(r.capital_pendiente),
    new Decimal(0),
  );
  y = drawSection(
    doc,
    y,
    `PRÉSTAMOS ACTIVOS (${activos.length})`,
    `Prestado: ${fmtRD(sumAM.toFixed(2))}  |  Pendiente: ${fmtRD(sumAP.toFixed(2))}`,
    colsAct,
    activos.map((r, i) => ({
      ...r,
      cedula: formatCedula(r.cedula),
      num: i + 1,
    })) as Record<string, unknown>[],
    {
      num: null,
      cliente: `TOTALES — ${activos.length} préstamos`,
      cedula: null,
      monto: sumAM.toFixed(2),
      capital_pendiente: sumAP.toFixed(2),
      tasa_interes: null,
      fecha_proximo_vencimiento: null,
    },
    { addPage },
  );

  if (mora.length > 0) {
    const colsMora: ColDef[] = [
      { header: "#", key: "num", w: 8, align: "center" },
      { header: "Cliente", key: "cliente", w: 42, align: "left" },
      { header: "Cédula", key: "cedula", w: 30, align: "left" },
      {
        header: "Monto Orig.",
        key: "monto",
        w: 28,
        align: "right",
        fmt: fmtRD,
      },
      {
        header: "Cap. Pend.",
        key: "capital_pendiente",
        w: 30,
        align: "right",
        fmt: fmtRD,
      },
      {
        header: "Días Atraso",
        key: "dias",
        w: 18,
        align: "center",
        fmt: (v) => (typeof v === "number" ? `${v} días` : String(v ?? "—")),
      },
      {
        header: "Fecha Venc.",
        key: "fecha_proximo_vencimiento",
        w: 26,
        align: "center",
        fmt: fmtDate,
      },
    ];
    const sumMM = mora.reduce((s, r) => s.plus(r.monto), new Decimal(0));
    const sumMP = mora.reduce(
      (s, r) => s.plus(r.capital_pendiente),
      new Decimal(0),
    );
    const moraRows = mora.map((r, i) => ({
      ...r,
      cedula: formatCedula(r.cedula),
      num: i + 1,
      dias: diasAtraso(r.fecha_proximo_vencimiento),
    })) as Record<string, unknown>[];
    const avgD =
      mora.length > 0
        ? Math.round(
            moraRows.reduce((s, r) => s + (r.dias as number), 0) / mora.length,
          )
        : 0;
    y = drawSection(
      doc,
      y,
      `PRÉSTAMOS VENCIDOS / MORA (${mora.length})`,
      `Pendiente: ${fmtRD(sumMP.toFixed(2))}  |  Prom. atraso: ${avgD} días`,
      colsMora,
      moraRows,
      {
        num: null,
        cliente: `TOTALES — ${mora.length} préstamos en mora`,
        cedula: null,
        monto: sumMM.toFixed(2),
        capital_pendiente: sumMP.toFixed(2),
        dias: `~${avgD} días (prom.)`,
        fecha_proximo_vencimiento: null,
      },
      { warningMode: true, addPage },
    );
  }

  if (clientesSaldo.length > 0) {
    const colsCli: ColDef[] = [
      { header: "#", key: "num", w: 10, align: "center" },
      { header: "Cliente", key: "cliente", w: 55, align: "left" },
      { header: "Teléfono", key: "telefono", w: 35, align: "left" },
      { header: "Empresa", key: "empresa", w: 42, align: "left" },
      {
        header: "Saldo Pendiente",
        key: "saldo",
        w: 40,
        align: "right",
        fmt: fmtRD,
      },
    ];
    const sumS = clientesSaldo.reduce(
      (s, c) => s.plus(c.saldo),
      new Decimal(0),
    );
    y = drawSection(
      doc,
      y,
      `CLIENTES CON SALDO PENDIENTE (${clientesSaldo.length})`,
      `Total: ${fmtRD(sumS.toFixed(2))}`,
      colsCli,
      clientesSaldo.map((c, i) => ({
        ...c,
        telefono: formatPhone(c.telefono),
        num: i + 1,
      })) as Record<string, unknown>[],
      {
        num: null,
        cliente: `TOTAL — ${clientesSaldo.length} clientes`,
        telefono: null,
        empresa: null,
        saldo: sumS.toFixed(2),
      },
      { addPage },
    );
  }

  stampFooters(doc, now);
  doc.setProperties({
    title: "Reporte General — Préstamos Elicar",
    subject: "Microfinanzas y Soluciones Crediticias",
    author: "Préstamos Elicar",
    creator: "Préstamos Elicar",
  });

  const buf = doc.output("arraybuffer");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prestamos-elicar-reporte-general-${today}.pdf"`,
    },
  });
}
