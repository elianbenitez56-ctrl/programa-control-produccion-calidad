import { clamp, diffMinutes } from "@/lib/captura"
import { computarCierre, emptyCierre, loadCierre } from "@/lib/cierre"
import { turnoActual } from "@/lib/turnos"
import type { ProduccionRegistro, RegistroAutocompletado } from "@/types/registroDiario"
import { demoProductionOrders, demoTurnoCierre } from "@/data/demo"

export interface DatosTurnoCalculados {
  produccionTotal: number
  produccionBuena: number
  produccionMala: number
  scrap: number
  tiempoImproductivoMin: number
  tiempoProductivoMin: number
  disponibilidad: number
  rendimiento: number
  calidad: number
  oee: number
}

/**
 * Calcula los indicadores del turno a partir de la producción y las paradas.
 * Reutiliza computarCierre (módulo de cierre de turno) y diffMinutes/clamp.
 */
export function calcularDatosTurno(
  produccionTotal: number,
  produccionBuena: number,
  produccionMala: number,
  scrap: number,
  paradas: { inicio: string; fin: string }[],
  meta: number,
  horaInicioTurno: string,
  horaFinTurno: string,
): DatosTurnoCalculados {
  const cierre = computarCierre(
    {
      ...emptyCierre(),
      produccionTotal,
      buena: produccionBuena,
      rechazada: produccionMala,
      paradas: paradas.map((p) => ({ id: "", motivo: "", observacion: "", ...p })),
    },
    horaInicioTurno,
    horaFinTurno,
  )

  const tiempoImproductivoMin = cierre.tiempoDetenidoMin
  const tiempoProductivoMin = Math.max(0, cierre.tiempoTurnoMin - tiempoImproductivoMin)
  const disponibilidad =
    cierre.tiempoTurnoMin > 0
      ? clamp((cierre.tiempoTurnoMin - tiempoImproductivoMin) / cierre.tiempoTurnoMin, 0, 1)
      : 1
  const rendimiento = meta > 0 ? clamp(produccionTotal / meta, 0, 1) : 0
  const calidad = produccionTotal > 0 ? clamp(produccionBuena / produccionTotal, 0, 1) : 0

  return {
    produccionTotal,
    produccionBuena,
    produccionMala,
    scrap,
    tiempoImproductivoMin,
    tiempoProductivoMin,
    disponibilidad,
    rendimiento,
    calidad,
    oee: disponibilidad * rendimiento * calidad,
  }
}

/**
 * Paradas de referencia cuando no existe un cierre de turno guardado.
 * Derivan del turno actual y del motivo más común (cambio de formato).
 */
function paradasDeReferencia(horaInicio: string): { inicio: string; fin: string }[] {
  const h0 = diffMinutes("00:00", horaInicio)
  return [
    { inicio: horaInicio, fin: formatMinutesClamped(h0 + 35) },
    { inicio: formatMinutesClamped(h0 + 130), fin: formatMinutesClamped(h0 + 150) },
  ]
}

function formatMinutesClamped(min: number): string {
  const total = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export interface AutocompletarParams {
  plantaNombre: string
  seccionNombre: string
  maquinaNombre: string
  operario: string
  ordenId: string | null
  /** Supervisor asignado al operario (si el sistema lo conoce) */
  supervisor?: string
}

/**
 * Construye la información autocompletada del registro diario.
 * Fuentes: contexto MES, sesión (operario), catálogo de órdenes y
 * borrador de cierre de turno si existe (módulos existentes).
 */
export function autocompletarRegistro({
  plantaNombre,
  seccionNombre,
  maquinaNombre,
  operario,
  ordenId,
  supervisor,
}: AutocompletarParams): RegistroAutocompletado {
  const orden = demoProductionOrders.find((o) => o.id === ordenId)
  const turno = turnoActual()
  const base = demoTurnoCierre

  const produccionTotal =
    typeof orden?.meta === "number" && orden.meta > 0 ? orden.meta * 0.62 : 9.6
  const produccionMala = produccionTotal * 0.04
  const produccionBuena = produccionTotal - produccionMala
  const scrap = 0

  const cierre = loadCierre()
  const paradas = cierre
    ? cierre.paradas.map((p) => ({ inicio: p.inicio, fin: p.fin }))
    : paradasDeReferencia(turno.horaInicio)

  const total = cierre && cierre.produccionTotal > 0 ? cierre.produccionTotal : produccionTotal
  const buena = cierre ? cierre.buena : produccionBuena
  const mala = cierre ? cierre.rechazada : produccionMala

  const datos = calcularDatosTurno(
    total,
    buena,
    mala,
    scrap,
    paradas,
    typeof orden?.meta === "number" ? orden.meta : 0,
    turno.horaInicio,
    turno.horaFin,
  )

  return {
    plantaNombre,
    seccionNombre,
    maquinaNombre,
    operario,
    supervisor: supervisor ?? base.supervisor,
    fecha: base.fecha,
    turno: turno.label,
    ordenId: orden?.id ?? "",
    referencia: orden?.referencia ?? base.referencia,
    producto: orden?.producto ?? base.producto,
    cliente: orden?.cliente ?? base.cliente,
    material: orden?.material ?? "—",
    meta: typeof orden?.meta === "number" ? orden.meta : 0,
    unidad: orden?.unidad ?? "t",
    horaInicio: turno.horaInicio,
    horaFin: turno.horaFin,
    ...datos,
  }
}

/** Convierte una fracción (0..1) a porcentaje entero para mostrar */
export function pct(valor: number): number {
  return Math.round(valor * 100)
}

/**
 * Resuelve el registro final combinando lo que el operario registró
 * (producción, paradas) con la información base autocompletada.
 * Recalcula los indicadores (OEE, disponibilidad, rendimiento, calidad)
 * reutilizando calcularDatosTurno. Es la fuente de verdad del wizard.
 */
export function resolverRegistro(
  base: RegistroAutocompletado,
  produccion: ProduccionRegistro,
  paradas: { inicio: string; fin: string }[],
): RegistroAutocompletado {
  const programada = produccion.programada > 0 ? produccion.programada : base.meta
  const producida = produccion.producida > 0 ? produccion.producida : base.produccionTotal
  const buena = produccion.buena > 0 ? produccion.buena : base.produccionBuena
  const rechazada = produccion.rechazada > 0 ? produccion.rechazada : base.produccionMala
  const horaInicio = produccion.horaInicio || base.horaInicio
  const horaFin = produccion.horaFin || base.horaFin
  const referencia = produccion.referencia || base.referencia

  const datos = calcularDatosTurno(
    producida,
    buena,
    rechazada,
    0,
    paradas,
    programada,
    horaInicio,
    horaFin,
  )

  return {
    ...base,
    referencia,
    meta: programada,
    horaInicio,
    horaFin,
    ...datos,
  }
}
