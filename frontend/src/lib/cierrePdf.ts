import type { jsPDF } from "jspdf"
import QRCode from "qrcode"

import { reasonLabel } from "@/config/captura"
import type { DemoTurnoCierreContext } from "@/data/demo"
import { demoModuleTables, demoProductionOrders } from "@/data/demo"
import { clamp, diffMinutes, formatMinutes } from "@/lib/captura"
import type { CierreDraft, CierreTotals } from "@/lib/cierre"

interface PdfParams {
  contexto: DemoTurnoCierreContext
  draft: CierreDraft
  totals: CierreTotals
  operario: string
}

const PAGE_W = 210
const M = 11
const CW = PAGE_W - M * 2
const BOTTOM = 278

const NAVY: [number, number, number] = [15, 23, 42]
const BLUE: [number, number, number] = [37, 99, 235]
const GREEN: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [239, 68, 68]
const AMBER: [number, number, number] = [245, 158, 11]
const PURPLE: [number, number, number] = [139, 92, 246]
const CYAN: [number, number, number] = [6, 182, 212]
const INDIGO: [number, number, number] = [99, 102, 241]
const SLATE_800: [number, number, number] = [30, 41, 59]
const SLATE_500: [number, number, number] = [100, 116, 139]
const SLATE_400: [number, number, number] = [148, 163, 184]
const SLATE_300: [number, number, number] = [203, 213, 225]
const SLATE_200: [number, number, number] = [226, 232, 240]
const SLATE_100: [number, number, number] = [241, 245, 249]
const SOFT_BLUE: [number, number, number] = [219, 234, 254]
const BG_FAINT: [number, number, number] = [248, 250, 252]
const WHITE: [number, number, number] = [255, 255, 255]

const FORMAT_CODE = "FR-PRO-002"
const SYSTEM_VERSION = "SIGPC v1.0.0"

type IconFn = (doc: jsPDF, cx: number, cy: number) => void

function nowParts(): { date: string; time: string } {
  const d = new Date()
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(d)
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
  return { date, time }
}

function newUid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 13)
    : `REG-${Date.now().toString(36).toUpperCase()}`
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFillColor(...BLUE)
  doc.rect(M, y, 1.8, 4, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(text.toUpperCase(), M + 3, y + 3.2)
  doc.setDrawColor(...SLATE_200)
  doc.setLineWidth(0.25)
  doc.line(M + 3, y + 5.6, PAGE_W - M, y + 5.6)
  return y + 9
}

function ensure(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= BOTTOM) return y
  doc.addPage()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 8, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(255)
  doc.text("SIGPC â€” FICHA DE REGISTRO DE PRODUCCIÃ“N", M, 5.4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(...SLATE_300)
  doc.text("Cierre de Turno", PAGE_W - M, 5.4, { align: "right" })
  doc.setFillColor(...BLUE)
  doc.rect(0, 8, PAGE_W, 0.5, "F")
  return 22
}

function infoCard(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string }[],
): number {
  const cols = 2
  const cellW = (CW - 8) / 2
  const cellH = 7
  const gap = 1.4
  const rows = Math.ceil(items.length / cols)
  items.forEach((it, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const x = M + c * (cellW + 8)
    const yy = y + r * (cellH + gap)
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.25)
    doc.setFillColor(...BG_FAINT)
    doc.rect(x, yy, cellW, cellH, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(4.8)
    doc.setTextColor(...SLATE_500)
    doc.text(it.label.toUpperCase(), x + 2.5, yy + 3.4)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.6)
    doc.setTextColor(...SLATE_800)
    if (it.label === "Estado") {
      doc.setFillColor(...GREEN)
      doc.circle(x + 2.5, yy + 5.5, 0.9, "F")
      doc.text(it.value, x + 4.8, yy + 6.6)
    } else {
      doc.text(it.value, x + 2.5, yy + 6.6)
    }
  })
  return y + rows * (cellH + gap) + 2
}

function kpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number],
  icon: IconFn,
  value: string,
  label: string,
): void {
  doc.setDrawColor(...SLATE_200)
  doc.setLineWidth(0.25)
  doc.setFillColor(...WHITE)
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD")
  const chip = 8
  doc.setFillColor(...accent)
  doc.roundedRect(x + 2, y + (h - chip) / 2, chip, chip, 1.6, 1.6, "F")
  icon(doc, x + 2 + chip / 2, y + h / 2)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(4.8)
  doc.setTextColor(...SLATE_500)
  doc.text(label.toUpperCase(), x + chip + 3.5, y + 7.2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.6)
  doc.setTextColor(...NAVY)
  doc.text(value, x + chip + 3.5, y + h - 2.8)
}

const iconBars: IconFn = (doc, cx, cy) => {
  doc.setFillColor(...WHITE)
  doc.rect(cx - 1.9, cy + 1.4, 1, 2.2, "F")
  doc.rect(cx - 0.6, cy - 0.3, 1, 3.9, "F")
  doc.rect(cx + 0.7, cy - 2, 1, 5.6, "F")
}

const iconCheck: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.8)
  doc.line(cx - 1.7, cy, cx - 0.5, cy + 1.4)
  doc.line(cx - 0.5, cy + 1.4, cx + 1.9, cy - 1.7)
}

const iconCross: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.8)
  doc.line(cx - 1.4, cy - 1.4, cx + 1.4, cy + 1.4)
  doc.line(cx - 1.4, cy + 1.4, cx + 1.4, cy - 1.4)
}

const iconTrend: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.8)
  doc.line(cx - 2, cy + 1.6, cx + 1.4, cy - 1.6)
  doc.line(cx + 1.4, cy - 1.6, cx + 1, cy + 0.2)
  doc.line(cx + 1.4, cy - 1.6, cx - 0.2, cy - 0.8)
}

const iconGauge: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.7)
  doc.circle(cx, cy, 1.9, "S")
  doc.line(cx - 1.9, cy, cx + 0.9, cy - 1.2)
}

const iconTarget: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.7)
  doc.circle(cx, cy, 1.9, "S")
  doc.circle(cx, cy, 1.1, "S")
  doc.setFillColor(...WHITE)
  doc.circle(cx, cy, 0.4, "F")
}

const iconClock: IconFn = (doc, cx, cy) => {
  doc.setDrawColor(255)
  doc.setLineWidth(0.7)
  doc.circle(cx, cy, 1.9, "S")
  doc.line(cx, cy, cx, cy - 1.2)
  doc.line(cx, cy, cx + 0.9, cy + 0.6)
}

const iconPause: IconFn = (doc, cx, cy) => {
  doc.setFillColor(...WHITE)
  doc.rect(cx - 1.5, cy - 1.9, 1.1, 3.8, "F")
  doc.rect(cx + 0.4, cy - 1.9, 1.1, 3.8, "F")
}

export async function generateCierrePdf({
  contexto,
  draft,
  totals,
  operario,
}: PdfParams): Promise<string> {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const { date: fechaGen, time: horaGen } = nowParts()
  const uid = newUid()

  const order = demoProductionOrders.find((o) => o.id === contexto.orden)
  const unit = order?.unidad ?? "t"
  const meta = order && typeof order.meta === "number" ? order.meta : null
  const loteRow = demoModuleTables.trazabilidad.find(
    (r) => String(r.orden) === contexto.orden,
  )
  const lote = loteRow && "lote" in loteRow ? String(loteRow.lote) : "â€”"

  const total = totals.produccionRegistrada
  const buena = totals.buena
  const recha = totals.rechazada
  const det = totals.tiempoDetenidoMin
  const turn = totals.tiempoTurnoMin
  const parn = totals.cantidadParadas

  const dispPct = turn > 0 ? clamp((turn - det) / turn, 0, 1) * 100 : 100
  const effPct = total > 0 ? clamp(buena / total, 0, 1) * 100 : 0
  const rendPct = meta && meta > 0 ? clamp(total / meta, 0, 1) * 100 : null
  const pctB = total > 0 ? (buena / total) * 100 : 0
  const pctR = total > 0 ? (recha / total) * 100 : 0
  const cumPct = meta && meta > 0 ? `${(clamp(total / meta, 0, 1) * 100).toFixed(1)}%` : "â€”"

  const qrPayload = JSON.stringify({
    sistema: "SIGPC",
    documento: "FICHA-CIERRE-TURNO",
    folio: `FT-${contexto.orden}`,
    orden: contexto.orden,
    campana: contexto.campana,
    turno: contexto.turno,
    fecha: contexto.fecha,
    registro: uid,
  })
  const qrUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  })

  /* ================= ENCABEZADO ================= */
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 24, "F")

  doc.setFillColor(...WHITE)
  doc.roundedRect(11, 7.5, 9, 9, 1.8, 1.8, "F")
  doc.setFillColor(...NAVY)
  doc.rect(13.1, 11.3, 1.05, 2.3, "F")
  doc.rect(14.4, 9.6, 1.05, 4, "F")
  doc.rect(15.7, 7.9, 1.05, 5.7, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(255)
  doc.text("SIGPC", 23, 12.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(...SLATE_300)
  doc.text("Sistema Integral de GestiÃ³n", 23, 17.2)
  doc.text("de ProducciÃ³n y Calidad", 23, 20.6)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(255)
  doc.text("FICHA DE REGISTRO DE PRODUCCIÃ“N", PAGE_W / 2, 12.5, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_300)
  doc.text("Cierre de Turno", PAGE_W / 2, 17.5, { align: "center" })

  doc.setFillColor(...WHITE)
  doc.roundedRect(181, 3.5, 18, 18, 1.5, 1.5, "F")
  doc.addImage(qrUrl, "PNG", 182.5, 4.5, 16, 16)

  /* ============ STRIP DE CONTROL DEL DOCUMENTO ============ */
  const stripCells = [
    { label: "Folio", value: `FT-${contexto.orden}` },
    { label: "CÃ³digo", value: FORMAT_CODE },
    { label: "VersiÃ³n", value: "1.0" },
    { label: "Estado", value: "Emitido" },
    { label: "Fecha generaciÃ³n", value: fechaGen },
    { label: "Hora generaciÃ³n", value: horaGen },
    { label: "NÂ° de pÃ¡ginas", value: "" },
  ]
  const cellW7 = CW / 7
  doc.setFillColor(...SLATE_100)
  doc.rect(0, 24, PAGE_W, 6.6, "F")
  stripCells.forEach((c, i) => {
    const x = M + i * cellW7
    if (i > 0) {
      doc.setDrawColor(...SLATE_200)
      doc.setLineWidth(0.25)
      doc.line(x, 24.6, x, 30.2)
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(4.6)
    doc.setTextColor(...SLATE_400)
    doc.text(c.label.toUpperCase(), x + 2, 26.6)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.8)
    doc.setTextColor(...SLATE_800)
    doc.text(c.value, x + 2, 29.3)
  })
  const pageCellX = M + 6 * cellW7 + 2

  doc.setFillColor(...BLUE)
  doc.rect(0, 30.6, PAGE_W, 0.6, "F")

  let y = 36

  /* ================= 1. INFORMACIÃ“N GENERAL ================= */
  y = ensure(doc, y, 88)
  y = sectionTitle(doc, y, "InformaciÃ³n general")
  y = infoCard(doc, y, [
    { label: "Orden de producciÃ³n", value: contexto.orden },
    { label: "CampaÃ±a", value: contexto.campana },
    { label: "Lote", value: lote },
    { label: "Producto", value: contexto.producto },
    { label: "Referencia", value: contexto.referencia },
    { label: "Cliente", value: contexto.cliente },
    { label: "Proceso", value: contexto.proceso },
    { label: "MÃ¡quina", value: contexto.maquina },
    { label: "LÃ­nea", value: contexto.linea },
    { label: "Turno", value: contexto.turno },
    { label: "Operario", value: operario },
    { label: "Supervisor", value: contexto.supervisor },
    { label: "Fecha", value: contexto.fecha },
    { label: "Hora de inicio", value: contexto.horaInicio },
    { label: "Hora de fin", value: contexto.horaFin },
    { label: "DuraciÃ³n del turno", value: formatMinutes(turn) },
    { label: "Estado", value: "Finalizado" },
  ])

  /* ================= 2. RESUMEN EJECUTIVO ================= */
  y = ensure(doc, y, 53)
  y = sectionTitle(doc, y, "Resumen ejecutivo")
  const kpis: {
    accent: [number, number, number]
    icon: IconFn
    label: string
    value: string
  }[] = [
    {
      accent: BLUE,
      icon: iconBars,
      label: "ProducciÃ³n total",
      value: `${total.toFixed(1)} ${unit}`,
    },
    {
      accent: GREEN,
      icon: iconCheck,
      label: "Cantidad buena",
      value: `${buena.toFixed(1)} ${unit}`,
    },
    {
      accent: RED,
      icon: iconCross,
      label: "Cantidad rechazada",
      value: `${recha.toFixed(1)} ${unit}`,
    },
    {
      accent: PURPLE,
      icon: iconTrend,
      label: "Rendimiento",
      value: rendPct == null ? "â€”" : `${Math.round(rendPct)}%`,
    },
    {
      accent: CYAN,
      icon: iconGauge,
      label: "Disponibilidad",
      value: `${Math.round(dispPct)}%`,
    },
    {
      accent: INDIGO,
      icon: iconTarget,
      label: "Eficiencia",
      value: `${Math.round(effPct)}%`,
    },
    {
      accent: AMBER,
      icon: iconClock,
      label: "Tiempo improductivo",
      value: formatMinutes(det),
    },
    {
      accent: SLATE_500,
      icon: iconPause,
      label: "NÃºmero de paradas",
      value: String(parn),
    },
  ]
  const cardW = (CW - 9) / 4
  const cardH = 18
  const gapX = 3
  kpis.forEach((k, i) => {
    const row = Math.floor(i / 4)
    const col = i % 4
    const x = M + col * (cardW + gapX)
    const cy = y + row * (cardH + 3)
    kpiCard(doc, x, cy, cardW, cardH, k.accent, k.icon, k.value, k.label)
  })
  y += 2 * (cardH + 3) + 2

  /* ================= 3. PRODUCCIÃ“N DEL TURNO ================= */
  y = ensure(doc, y, 44)
  y = sectionTitle(doc, y, "ProducciÃ³n del turno")
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    tableWidth: CW,
    head: [
      [
        { content: "CONCEPTO", styles: { halign: "left" } },
        `CANTIDAD (${unit.toUpperCase()})`,
        "% DEL TOTAL",
      ],
    ],
    body: [
      [
        { content: "ProducciÃ³n total del turno", styles: { fontStyle: "bold" } },
        { content: total.toFixed(1), styles: { fontStyle: "bold", halign: "right" } },
        { content: "100.0", styles: { fontStyle: "bold", halign: "right" } },
      ],
      ["Cantidad buena", { content: buena.toFixed(1), styles: { halign: "right" as const } }, { content: pctB.toFixed(1), styles: { halign: "right" as const } }],
      ["Cantidad rechazada", { content: recha.toFixed(1), styles: { halign: "right" as const } }, { content: pctR.toFixed(1), styles: { halign: "right" as const } }],
      ...(meta
        ? [["Meta del turno", { content: meta.toFixed(1), styles: { halign: "right" as const } }, { content: "—", styles: { halign: "right" as const } }]]
        : []),
    ],
    foot: [
      [
        { content: "CUMPLIMIENTO CONTRA META", colSpan: 2 },
        { content: cumPct, styles: { halign: "right" } },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    footStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold", fontSize: 7 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  /* ================= 4. TIEMPOS IMPRODUCTIVOS ================= */
  y = ensure(doc, y, 9 + 20 + draft.paradas.length * 6)
  y = sectionTitle(doc, y, "Tiempos improductivos")
  if (draft.paradas.length === 0) {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 10, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_500)
    doc.text("No se registraron tiempos improductivos en este turno.", M + 4.5, y + 8.2)
    y += 18
  } else {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      tableWidth: CW,
      head: [["INICIO", "FIN", "DURACIÃ“N", "MOTIVO", "OBSERVACIÃ“N", "RESPONSABLE"]],
      body: draft.paradas.map((p) => [
        p.inicio,
        p.fin,
        formatMinutes(diffMinutes(p.inicio, p.fin)),
        reasonLabel(p.motivo),
        p.observacion || "â€”",
        operario,
      ]),
      foot: [
        [
          { content: "TIEMPO IMPRODUCTIVO TOTAL", colSpan: 3 },
          { content: formatMinutes(det), styles: { halign: "right" } },
          { content: `${parn} PARADAS`, styles: { halign: "center" } },
          { content: "" },
        ],
      ],
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
      footStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 15 },
        2: { cellWidth: 16 },
        3: { cellWidth: 44 },
        4: { cellWidth: 58 },
        5: { cellWidth: 40 },
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  /* ================= 5. OBSERVACIONES ================= */
  y = ensure(doc, y, 42)
  y = sectionTitle(doc, y, "Observaciones")
  const obsText = draft.observaciones.trim()
  const obsLines = doc.splitTextToSize(
    obsText || "Sin observaciones registradas en el turno.",
    CW - 10,
  ) as string[]
  const obsH = Math.max(26, obsLines.length * 4.6 + 14)
  doc.setDrawColor(...SLATE_200)
  doc.setLineWidth(0.3)
  doc.setFillColor(...BG_FAINT)
  doc.roundedRect(M, y + 2, CW, obsH, 1.5, 1.5, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(5.8)
  doc.setTextColor(...SLATE_400)
  doc.text("OBSERVACIONES DEL TURNO", M + 4.5, y + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...(obsText ? SLATE_800 : SLATE_500))
  obsLines.forEach((line, i) => {
    doc.text(line, M + 4.5, y + 13 + i * 4.6)
  })
  y += obsH + 10

  /* ================= 6. REGISTRO Y TRAZABILIDAD ================= */
  y = ensure(doc, y, 47)
  y = sectionTitle(doc, y, "Registro y trazabilidad")
  y = infoCard(doc, y, [
    { label: "NÃºmero de registro", value: `REG-${uid.toUpperCase()}` },
    { label: "Usuario del cierre", value: operario },
    { label: "Fecha de cierre", value: fechaGen },
    { label: "Hora de cierre", value: horaGen },
    { label: "Equipo utilizado", value: `EstaciÃ³n de captura Â· ${contexto.maquina}` },
    { label: "VersiÃ³n del sistema", value: SYSTEM_VERSION },
    { label: "CÃ³digo interno", value: FORMAT_CODE },
    { label: "ID del registro", value: uid },
  ])

  /* ================= 7. FIRMAS Y VALIDACIONES ================= */
  y = ensure(doc, y, 41)
  y = sectionTitle(doc, y, "Firmas y validaciones")
  const cardY = y + 2
  doc.setDrawColor(...SLATE_200)
  doc.setLineWidth(0.3)
  doc.setFillColor(...WHITE)
  doc.roundedRect(M, cardY, CW, 28, 1.5, 1.5, "FD")
  const colW = CW / 3
  const sigCols = [
    { title: "ElaborÃ³", name: operario, role: "Operario de lÃ­nea" },
    { title: "RevisÃ³", name: contexto.supervisor, role: "Supervisor de producciÃ³n" },
    { title: "AutorizÃ³", name: "", role: "Aseguramiento de calidad" },
  ]
  sigCols.forEach((c, i) => {
    const x = M + i * colW
    if (i > 0) {
      doc.setDrawColor(...SLATE_200)
      doc.setLineWidth(0.25)
      doc.line(x, cardY + 3, x, cardY + 25)
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6)
    doc.setTextColor(...BLUE)
    doc.text(c.title.toUpperCase(), x + colW / 2, cardY + 8, { align: "center" })
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...SLATE_800)
    doc.text(c.name || "________________", x + colW / 2, cardY + 15, { align: "center" })
    doc.setDrawColor(...SLATE_400)
    doc.setLineWidth(0.35)
    doc.setLineDashPattern([1.4, 1], 0)
    doc.line(x + 10, cardY + 20, x + colW - 10, cardY + 20)
    doc.setLineDashPattern([], 0)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.5)
    doc.setTextColor(...SLATE_400)
    doc.text(c.role.toUpperCase(), x + colW / 2, cardY + 23, { align: "center" })
    doc.setFontSize(6)
    doc.setTextColor(...SLATE_500)
    doc.text(`Fecha: ${fechaGen}`, x + colW / 2, cardY + 27, { align: "center" })
  })
  y += 28 + 10

  /* ================= PIE DE PÃGINA ================= */
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.25)
    doc.line(M, 288.5, PAGE_W - M, 288.5)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.5)
    doc.setTextColor(...SLATE_500)
    doc.text(
      "Documento generado automÃ¡ticamente por SIGPC Â· No requiere firma manuscrita si fue aprobado digitalmente",
      M,
      292.3,
    )
    doc.text(`${SYSTEM_VERSION} Â· ${FORMAT_CODE}`, PAGE_W / 2, 292.3, { align: "center" })
    doc.text(`PÃ¡gina ${i} de ${totalPages}`, PAGE_W - M, 292.3, { align: "right" })
  }
  doc.setPage(1)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(...SLATE_800)
  doc.text(String(totalPages), pageCellX, 29.3)

  const fileName = `CierreTurno_${contexto.orden}_${contexto.fecha.replace(/\s/g, "-")}.pdf`
  doc.save(fileName)
  return fileName
}
