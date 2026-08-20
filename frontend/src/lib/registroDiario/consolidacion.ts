import { formatMinutes } from "@/lib/captura"
import type { RegistroDiarioCompleto } from "@/types/registroDiario"

export interface FilaAreaConsolidada {
  folio: string
  seccionNombre: string
  maquinaNombre: string
  operario: string
  fecha: string
  turno: string
  programada: number
  produccionTotal: number
  produccionBuena: number
  produccionMala: number
  reprocesada: number
  paradas: number
  tiempoParadasMin: number
  oee: number
}

export interface ConsolidadoOrden {
  ordenId: string
  areas: FilaAreaConsolidada[]
  totalProgramada: number
  totalProducida: number
  totalBuena: number
  totalMala: number
  totalReprocesada: number
  totalParadas: number
  tiempoParadasMin: number
  oeePromedio: number
  calidadPromedio: number
}

/**
 * Consolida todos los registros diarios de una Orden de Producción:
 * agrupa por área/máquina, suma producción y paradas y promedia OEE.
 * Es la base del reporte único por orden.
 */
export function consolidarPorOrden(
  registros: RegistroDiarioCompleto[],
  ordenId: string,
): ConsolidadoOrden | null {
  const deEstaOrden = registros.filter((r) => r.autocompletado.ordenId === ordenId)
  if (deEstaOrden.length === 0) return null

  const areas: FilaAreaConsolidada[] = deEstaOrden.map((r) => {
    const tiempoParadasMin = r.draft.paradas.reduce((acc, p) => {
      if (!p.inicio || !p.fin) return acc
      const m =
        Number(p.fin.slice(0, 2)) * 60 +
        Number(p.fin.slice(3, 5)) -
        (Number(p.inicio.slice(0, 2)) * 60 + Number(p.inicio.slice(3, 5)))
      return acc + (m > 0 ? m : 0)
    }, 0)
    return {
      folio: r.folio,
      seccionNombre: r.autocompletado.seccionNombre,
      maquinaNombre: r.autocompletado.maquinaNombre,
      operario: r.autocompletado.operario,
      fecha: r.autocompletado.fecha,
      turno: r.autocompletado.turno,
      programada: r.draft.produccion.programada || r.autocompletado.meta,
      produccionTotal: r.autocompletado.produccionTotal,
      produccionBuena: r.autocompletado.produccionBuena,
      produccionMala: r.autocompletado.produccionMala,
      reprocesada: r.draft.produccion.reprocesada,
      paradas: r.draft.paradas.length,
      tiempoParadasMin,
      oee: r.autocompletado.oee,
    }
  })

  const suma = (sel: (f: FilaAreaConsolidada) => number) =>
    areas.reduce((acc, a) => acc + (sel(a) || 0), 0)

  return {
    ordenId,
    areas,
    totalProgramada: suma((a) => a.programada),
    totalProducida: suma((a) => a.produccionTotal),
    totalBuena: suma((a) => a.produccionBuena),
    totalMala: suma((a) => a.produccionMala),
    totalReprocesada: suma((a) => a.reprocesada),
    totalParadas: suma((a) => a.paradas),
    tiempoParadasMin: suma((a) => a.tiempoParadasMin),
    oeePromedio: areas.length ? areas.reduce((acc, a) => acc + a.oee, 0) / areas.length : 0,
    calidadPromedio: areas.length
      ? areas.reduce((acc, a) => {
          const total = a.produccionTotal
          return acc + (total > 0 ? a.produccionBuena / total : 0)
        }, 0) / areas.length
      : 0,
  }
}

/** Texto corto del tiempo de paradas acumulado */
export function tiempoParadasTexto(min: number): string {
  return formatMinutes(min)
}