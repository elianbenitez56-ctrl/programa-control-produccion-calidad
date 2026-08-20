export type CapturaStep = 1 | 2 | 3 | 4 | 5

export interface ProduccionRecord {
  id: string
  hora: string
  cantidad: number
  rechazada: number
  observacion: string
}

export interface ParadaRecord {
  id: string
  inicio: string
  fin: string
  motivo: string
  observacion: string
}

export interface CapturaDraft {
  ordenId: string | null
  checklist: Record<string, boolean>
  comentarioPreparacion: string
  produccion: ProduccionRecord[]
  paradas: ParadaRecord[]
  inicioISO: string | null
  observacionesFinales: string
}

export interface CapturaTotals {
  produccionTotal: number
  buena: number
  rechazada: number
  tiempoDetenidoMin: number
  tiempoTranscurridoMin: number
  disponibilidad: number
  rendimiento: number
  calidad: number
  oee: number
  avancePct: number
  meta: number
}

const STORAGE_KEY = "sigpc.captura"

export function newId(): string {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : null
  return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyDraft(): CapturaDraft {
  return {
    ordenId: null,
    checklist: {},
    comentarioPreparacion: "",
    produccion: [],
    paradas: [],
    inicioISO: null,
    observacionesFinales: "",
  }
}

export function loadDraft(): CapturaDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CapturaDraft
    if (!parsed || typeof parsed !== "object") return null
    return {
      ...emptyDraft(),
      ...parsed,
      checklist: parsed.checklist ?? {},
      produccion: Array.isArray(parsed.produccion) ? parsed.produccion : [],
      paradas: Array.isArray(parsed.paradas) ? parsed.paradas : [],
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: CapturaDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // almacenamiento no disponible: el borrador se pierde al recargar
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignorar
  }
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function diffMinutes(inicio: string, fin: string): number {
  const start = minutesOf(inicio)
  const end = fin ? minutesOf(fin) : minutesOf(nowTime())
  let diff = end - start
  if (diff < 0) diff += 24 * 60
  return diff
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function formatElapsed(totalMinutes: number): string {
  const total = Math.max(0, Math.floor(totalMinutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  const padded = (n: number) => String(n).padStart(2, "0")
  return `${padded(h)}:${padded(m)}:00`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computeTotals(
  draft: CapturaDraft,
  meta: number,
  nowEpoch: number,
): CapturaTotals {
  const produccionTotal = draft.produccion.reduce((sum, r) => sum + r.cantidad, 0)
  const rechazada = draft.produccion.reduce((sum, r) => sum + r.rechazada, 0)
  const buena = Math.max(0, produccionTotal - rechazada)

  const detenido = draft.paradas.reduce((sum, p) => sum + diffMinutes(p.inicio, p.fin), 0)

  let transcurrido = 0
  if (draft.inicioISO) {
    transcurrido = Math.max(0, (nowEpoch - new Date(draft.inicioISO).getTime()) / 60000)
  }

  const disponibilidad = transcurrido > 0
    ? clamp((transcurrido - detenido) / transcurrido, 0, 1)
    : 1

  const rendimiento = meta > 0 ? clamp(produccionTotal / meta, 0, 1) : 0

  const calidad = produccionTotal > 0
    ? clamp(buena / produccionTotal, 0, 1)
    : 0

  return {
    produccionTotal,
    buena,
    rechazada,
    tiempoDetenidoMin: detenido,
    tiempoTranscurridoMin: transcurrido,
    disponibilidad,
    rendimiento,
    calidad,
    oee: disponibilidad * rendimiento * calidad,
    avancePct: meta > 0 ? (produccionTotal / meta) * 100 : 0,
    meta,
  }
}

export function capturaReady(draft: CapturaDraft): { ok: boolean; pendientes: string[] } {
  const pendientes: string[] = []
  if (!draft.ordenId) pendientes.push("Selecciona una orden de producción")
  const checklistKeys = Object.keys(draft.checklist)
  if (checklistKeys.some((key) => !draft.checklist[key])) {
    pendientes.push("Completa la lista de preparación")
  }
  if (draft.produccion.length === 0) {
    pendientes.push("Registra al menos una producción")
  }
  return { ok: pendientes.length === 0, pendientes }
}