import type { jsPDF } from "jspdf"
import QRCode from "qrcode"

import { reasonLabel } from "@/config/captura"
import { checklistCalidadItems } from "@/config/registroDiario"
import { diffMinutes, formatMinutes } from "@/lib/captura"
import type { RegistroDiarioCompleto } from "@/types/registroDiario"

const PAGE_W = 210
const M = 11
const CW = PAGE_W - M * 2
const BOTTOM = 278

const NAVY: [number, number, number] = [15, 23, 42]
const BLUE: [number, number, number] = [37, 99, 235]
const GREEN: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [239, 68, 68]
const AMBER: [number, number, number] = [245, 158, 11]
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
  doc.text("SIGPC - REGISTRO DIARIO DE PRODUCCION", M, 5.4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(...SLATE_300)
  doc.text("Fin de turno", PAGE_W - M, 5.4, { align: "right" })
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
    doc.text(it.value, x + 2.5, yy + 6.6)
  })
  return y + rows * (cellH + gap) + 2
}

export async function generarPdfRegistroDiario(registro: RegistroDiarioCompleto): Promise<string> {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const { autocompletado: auto, draft } = registro
  const { date: fechaGen, time: horaGen } = nowParts()

  const qrUrl = await QRCode.toDataURL(
    JSON.stringify({
      sistema: "SIGPC",
      documento: "REGISTRO-DIARIO-PRODUCCION",
      folio: registro.folio,
      orden: auto.ordenId,
      turno: auto.turno,
      fecha: auto.fecha,
      maquina: auto.maquinaNombre,
    }),
    { errorCorrectionLevel: "M", margin: 1, width: 260, color: { dark: "#0F172A", light: "#FFFFFF" } },
  )

  const doc = new jsPDF({ unit: "mm", format: "a4" })

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
  doc.text("Sistema Integral de Gestion", 23, 17.2)
  doc.text("de Produccion y Calidad", 23, 20.6)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(255)
  doc.text("FICHA DE REGISTRO DIARIO DE PRODUCCION", PAGE_W / 2, 12.5, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_300)
  doc.text("Fin de turno", PAGE_W / 2, 17.5, { align: "center" })

  doc.setFillColor(...WHITE)
  doc.roundedRect(181, 3.5, 18, 18, 1.5, 1.5, "F")
  doc.addImage(qrUrl, "PNG", 182.5, 4.5, 16, 16)

  /* ============ STRIP DE CONTROL ============ */
  const stripCells = [
    { label: "Folio", value: registro.folio },
    { label: "Codigo", value: FORMAT_CODE },
    { label: "Version", value: "1.0" },
    { label: "Estado", value: "Emitido" },
    { label: "Fecha generacion", value: fechaGen },
    { label: "Hora generacion", value: horaGen },
    { label: "N de paginas", value: "" },
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

  /* ================= 1. INFORMACION GENERAL ================= */
  y = ensure(doc, y, 74)
  y = sectionTitle(doc, y, "Informacion general")
  y = infoCard(doc, y, [
    { label: "Planta", value: auto.plantaNombre },
    { label: "Seccion", value: auto.seccionNombre },
    { label: "Maquina", value: auto.maquinaNombre },
    { label: "Orden de produccion", value: auto.ordenId || "—" },
    { label: "Producto", value: auto.producto },
    { label: "Referencia", value: auto.referencia || "—" },
    { label: "Cliente", value: auto.cliente },
    { label: "Material principal", value: auto.material },
    { label: "Operario", value: auto.operario },
    { label: "Supervisor", value: auto.supervisor },
    { label: "Fecha", value: auto.fecha },
    { label: "Turno", value: auto.turno },
    { label: "Cantidad programada", value: `${auto.meta.toFixed(1)} ${auto.unidad}` },
    { label: "Hora de inicio", value: auto.horaInicio },
    { label: "Hora de fin", value: auto.horaFin },
    { label: "Tiempo productivo", value: formatMinutes(auto.tiempoProductivoMin) },
    { label: "Tiempo improductivo", value: formatMinutes(auto.tiempoImproductivoMin) },
  ])

  /* ================= 2. PRODUCCION DEL TURNO ================= */
  y = ensure(doc, y, 46)
  y = sectionTitle(doc, y, "Produccion del turno")
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    tableWidth: CW,
    head: [["CONCEPTO", `CANTIDAD (${auto.unidad.toUpperCase()})`, "% DEL TOTAL"]],
    body: [
      [
        { content: "Produccion total", styles: { fontStyle: "bold" } },
        { content: auto.produccionTotal.toFixed(1), styles: { fontStyle: "bold", halign: "right" } },
        { content: "100.0", styles: { fontStyle: "bold", halign: "right" } },
      ],
      ["Produccion buena", { content: auto.produccionBuena.toFixed(1), styles: { halign: "right" as const } }, { content: (auto.produccionTotal > 0 ? (auto.produccionBuena / auto.produccionTotal) * 100 : 0).toFixed(1), styles: { halign: "right" as const } }],
      ["Produccion mala", { content: auto.produccionMala.toFixed(1), styles: { halign: "right" as const } }, { content: (auto.produccionTotal > 0 ? (auto.produccionMala / auto.produccionTotal) * 100 : 0).toFixed(1), styles: { halign: "right" as const } }],
      ["Produccion reprocesada", { content: draft.produccion.reprocesada.toFixed(1), styles: { halign: "right" as const } }, { content: (auto.produccionTotal > 0 ? (draft.produccion.reprocesada / auto.produccionTotal) * 100 : 0).toFixed(1), styles: { halign: "right" as const } }],
      ["Disponibilidad", { content: "", styles: { halign: "right" as const } }, { content: `${(auto.disponibilidad * 100).toFixed(1)}%`, styles: { halign: "right" as const } }],
      ["Rendimiento", { content: "", styles: { halign: "right" as const } }, { content: `${(auto.rendimiento * 100).toFixed(1)}%`, styles: { halign: "right" as const } }],
      ["Calidad", { content: "", styles: { halign: "right" as const } }, { content: `${(auto.calidad * 100).toFixed(1)}%`, styles: { halign: "right" as const } }],
    ],
    foot: [
      [
        { content: "OEE DEL TURNO", colSpan: 2 },
        { content: `${(auto.oee * 100).toFixed(1)}%`, styles: { halign: "right" } },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    footStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold", fontSize: 7 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  /* ================= 3. MATERIAS PRIMAS ================= */
  y = ensure(doc, y, 30 + draft.materiasPrima.length * 6.5)
  y = sectionTitle(doc, y, "Materias primas")
  if (draft.materiasPrima.length === 0) {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 10, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_500)
    doc.text("No se registraron materias primas en este turno.", M + 4.5, y + 8.2)
    y += 18
  } else {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      tableWidth: CW,
      head: [["MATERIAL", "LOTE", "UTILIZADA", "DESPERDICIADA", "DEVUELTA"]],
      body: draft.materiasPrima.map((m) => [
        m.material || "—",
        m.lote || "—",
        `${m.cantidadUtilizada.toFixed(1)} ${auto.unidad}`,
        `${m.cantidadDesperdiciada.toFixed(1)} ${auto.unidad}`,
        `${m.cantidadDevuelta.toFixed(1)} ${auto.unidad}`,
      ]),
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  /* ================= 4. PARADAS ================= */
  y = ensure(doc, y, 26 + draft.paradas.length * 6.5)
  y = sectionTitle(doc, y, "Paradas del turno")
  if (draft.paradas.length === 0) {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 10, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_500)
    doc.text("No se registraron paradas en este turno.", M + 4.5, y + 8.2)
    y += 18
  } else {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      tableWidth: CW,
      head: [["HORA INICIO", "HORA FIN", "DURACION", "MOTIVO", "OBSERVACION"]],
      body: draft.paradas.map((p) => [
        p.inicio || "—",
        p.fin || "—",
        p.inicio && p.fin ? formatMinutes(Math.max(0, diffMinutes(p.inicio, p.fin))) : "—",
        reasonLabel(p.motivo),
        p.observacion || "—",
      ]),
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  /* ================= 5. CHEQUEO DE CALIDAD ================= */
  y = ensure(doc, y, 28 + Math.ceil(checklistCalidadItems.length / 2) * 8)
  y = sectionTitle(doc, y, "Chequeo de calidad")
  checklistCalidadItems.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const ok = Boolean(draft.checklist[item.key])
    const x = M + col * ((CW - 8) / 2 + 8)
    const yy = y + 2 + row * 8
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.25)
    doc.setFillColor(...(ok ? SOFT_BLUE : BG_FAINT))
    doc.rect(x, yy, (CW - 8) / 2, 7, "FD")
    doc.setFillColor(...(ok ? GREEN : RED))
    doc.circle(x + 4, yy + 3.5, 1.4, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.2)
    doc.setTextColor(...SLATE_800)
    doc.text(item.label, x + 7.5, yy + 4.4)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.8)
    doc.setTextColor(...(ok ? GREEN : RED))
    doc.text(ok ? "CUMPLE" : "PENDIENTE", x + (CW - 8) / 2 - 3, yy + 4.4, { align: "right" })
  })
  y += 2 + Math.ceil(checklistCalidadItems.length / 2) * 8 + 8

  /* ================= 5. DEFECTOS ================= */
  y = ensure(doc, y, 26 + draft.defectos.length * 6.5)
  y = sectionTitle(doc, y, "Defectos encontrados")
  if (draft.defectos.length === 0) {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 10, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_500)
    doc.text("No se registraron defectos en este turno.", M + 4.5, y + 8.2)
    y += 18
  } else {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      tableWidth: CW,
      head: [["TIPO DE DEFECTO", "CANTIDAD", "OBSERVACION"]],
      body: draft.defectos.map((d) => [d.tipo, String(d.cantidad), d.observacion || "—"]),
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 2.2, lineColor: SLATE_200, lineWidth: 0.15, textColor: SLATE_800 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  /* ================= 6. INCIDENCIAS ================= */
  y = ensure(doc, y, 26)
  y = sectionTitle(doc, y, "Incidencias del turno")
  const incidencias = [
    ...draft.incidencias,
    ...(draft.incidenciaOtroTexto.trim() ? [`Otro: ${draft.incidenciaOtroTexto}`] : []),
  ]
  if (incidencias.length === 0) {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 10, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_500)
    doc.text("No se registraron incidencias en este turno.", M + 4.5, y + 8.2)
    y += 18
  } else {
    doc.setDrawColor(...SLATE_200)
    doc.setLineWidth(0.3)
    doc.setFillColor(...BG_FAINT)
    doc.roundedRect(M, y + 2, CW, 12, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_800)
    incidencias.forEach((inc, i) => {
      doc.setFillColor(...AMBER)
      doc.circle(M + 4.5, y + 8.5 + i * 5, 1, "F")
      doc.text(inc, M + 7.5, y + 8.9 + i * 5)
    })
    y += 12 + 8
  }

  /* ================= 7. OBSERVACIONES ================= */
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

  /* ================= 8. FIRMAS DIGITALES ================= */
  y = ensure(doc, y, 41)
  y = sectionTitle(doc, y, "Firmas y validaciones")
  const cardY = y + 2
  doc.setDrawColor(...SLATE_200)
  doc.setLineWidth(0.3)
  doc.setFillColor(...WHITE)
  doc.roundedRect(M, cardY, CW, 28, 1.5, 1.5, "FD")
  const colW = CW / 3
  const sigCols = [
    { title: "Elaboro", name: auto.operario, role: "Operario de linea", img: draft.firmas.operario },
    { title: "Reviso", name: auto.supervisor, role: "Supervisor de produccion", img: draft.firmas.supervisor },
    { title: "Inspecciono", name: "", role: "Inspector de calidad", img: draft.firmas.inspectorCalidad },
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
    if (c.img) {
      doc.addImage(c.img, "PNG", x + 12, cardY + 9.5, colW - 24, 9.5)
    } else {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(...SLATE_400)
      doc.text("________________", x + colW / 2, cardY + 15.5, { align: "center" })
    }
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

  /* ================= PIE DE PAGINA ================= */
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
      "Documento generado automaticamente por SIGPC - No requiere firma manuscrita si fue aprobado digitalmente",
      M,
      292.3,
    )
    doc.text(`${SYSTEM_VERSION} - ${FORMAT_CODE}`, PAGE_W / 2, 292.3, { align: "center" })
    doc.text(`Pagina ${i} de ${totalPages}`, PAGE_W - M, 292.3, { align: "right" })
  }
  doc.setPage(1)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(...SLATE_800)
  doc.text(String(totalPages), pageCellX, 29.3)

  const fileName = `RegistroDiario_${registro.folio}.pdf`
  doc.save(fileName)
  return fileName
}
