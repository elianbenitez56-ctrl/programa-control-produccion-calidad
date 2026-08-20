/**
 * Tipos e interfaces del módulo "Registro Diario de Producción".
 * El registro reemplaza el formato físico de fin de turno: todo lo que
 * el sistema ya conoce se autocompleta y el operario solo registra
 * materias primas, calidad, defectos, incidencias, observaciones y firmas.
 */

export interface MateriaPrimaItem {
  id: string
  material: string
  lote: string
  cantidadUtilizada: number
  cantidadDesperdiciada: number
  cantidadDevuelta: number
}

/** Parada registrada por el operario dentro del turno */
export interface ParadaRegistroItem {
  id: string
  inicio: string
  fin: string
  motivo: string
  observacion: string
}

/** Producción del turno registrada por el operario (prellenada por el sistema) */
export interface ProduccionRegistro {
  referencia: string
  programada: number
  producida: number
  buena: number
  rechazada: number
  reprocesada: number
  horaInicio: string
  horaFin: string
}

export interface DefectoItem {
  id: string
  tipo: string
  cantidad: number
  observacion: string
}

export interface FirmasRegistro {
  /** Data URL PNG de la firma, null si no se ha firmado */
  operario: string | null
  supervisor: string | null
  inspectorCalidad: string | null
}

export type FirmaCampo = keyof FirmasRegistro

export interface RegistroDiarioDraft {
  ordenId: string | null
  produccion: ProduccionRegistro
  paradas: ParadaRegistroItem[]
  checklist: Record<string, boolean>
  materiasPrima: MateriaPrimaItem[]
  defectos: DefectoItem[]
  incidencias: string[]
  incidenciaOtroTexto: string
  observaciones: string
  firmas: FirmasRegistro
  inicioISO: string | null
}

/**
 * Información autocompletada por el sistema a partir de los módulos
 * existentes (contexto MES, sesión, cierre de turno y órdenes demo).
 * Es de solo lectura para el operario.
 */
export interface RegistroAutocompletado {
  plantaNombre: string
  seccionNombre: string
  maquinaNombre: string
  operario: string
  supervisor: string
  fecha: string
  turno: string
  ordenId: string
  referencia: string
  producto: string
  cliente: string
  material: string
  meta: number
  unidad: string
  horaInicio: string
  horaFin: string
  tiempoProductivoMin: number
  tiempoImproductivoMin: number
  produccionBuena: number
  produccionMala: number
  scrap: number
  produccionTotal: number
  disponibilidad: number
  rendimiento: number
  calidad: number
  oee: number
}

/** Registro completo persistido (histórico) y base del PDF */
export interface RegistroDiarioCompleto {
  id: string
  folio: string
  creadoEn: string
  pdfFileName: string | null
  autocompletado: RegistroAutocompletado
  draft: RegistroDiarioDraft
}

export interface ValidacionRegistro {
  ok: boolean
  pendientes: string[]
}
