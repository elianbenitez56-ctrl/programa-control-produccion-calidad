import { diffMinutes, newId } from "@/lib/captura"

export interface ParadaCierre {
  id: string
  inicio: string
  fin: string
  motivo: string
  observacion: string
}

export interface CierreDraft {
  produccionTotal: number
  buena: number
  rechazada: number
  paradas: ParadaCierre[]
  observaciones: string
}

export interface CierreTotals {
  produccionRegistrada: number
  buena: number
  rechazada: number
  tiempoDetenidoMin: number
  cantidadParadas: number
  tiempoTurnoMin: number
}

const STORAGE_KEY = "sigpc.cierreTurno"

export function emptyCierre(): CierreDraft {
  return {
    produccionTotal: 0,
    buena: 0,
    rechazada: 0,
    paradas: [],
    observaciones: "",
  }
}

export function loadCierre(): CierreDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CierreDraft
    return {
      ...emptyCierre(),
      ...parsed,
      paradas: Array.isArray(parsed.paradas) ? parsed.paradas : [],
    }
  } catch {
    return null
  }
}

export function saveCierre(draft: CierreDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // almacenamiento no disponible
  }
}

export function clearCierre(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignorar
  }
}

export function computarCierre(
  draft: CierreDraft,
  horaInicioTurno: string,
  horaFinTurno: string,
): CierreTotals {
  return {
    produccionRegistrada: draft.produccionTotal,
    buena: draft.buena,
    rechazada: draft.rechazada,
    tiempoDetenidoMin: draft.paradas.reduce(
      (sum, p) => sum + diffMinutes(p.inicio, p.fin),
      0,
    ),
    cantidadParadas: draft.paradas.length,
    tiempoTurnoMin: diffMinutes(horaInicioTurno, horaFinTurno),
  }
}

export function cierreReady(draft: CierreDraft): { ok: boolean; pendientes: string[] } {
  const pendientes: string[] = []
  if (draft.produccionTotal <= 0) {
    pendientes.push("Registra la producción total del turno")
  }
  if (Math.abs(draft.produccionTotal - draft.buena - draft.rechazada) > 0.01) {
    pendientes.push("La cantidad buena + rechazada debe sumar la producción total")
  }
  const conDetalle = draft.paradas.filter(
    (p) => !p.inicio || !p.fin || !p.motivo,
  )
  if (conDetalle.length > 0) {
    pendientes.push(`Completa los tiempos improductivos (${conDetalle.length} incompleto(s))`)
  }
  return { ok: pendientes.length === 0, pendientes }
}

export { newId, diffMinutes }