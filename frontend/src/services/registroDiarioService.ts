import type { RegistroDiarioCompleto, RegistroDiarioDraft } from "@/types/registroDiario"

/**
 * Servicio de persistencia del Registro Diario.
 * Guarda el borrador y el histórico de registros finalizados.
 *
 * CONTRATO FUTURO (backend): cuando se implemente el módulo de producción
 * en el API, estas funciones se reemplazarán por llamadas REST sin cambios
 * en la página:
 *   - POST   /api/v1/registros-diarios
 *   - GET    /api/v1/registros-diarios?planta=&seccion=&maquina=&fecha=
 *   - GET    /api/v1/registros-diarios/{id}/pdf
 * El payload serializable ya coincide con RegistroDiarioCompleto.
 */

const STORAGE_DRAFT = "sigpc.registroDiario.borrador"
const STORAGE_REGISTROS = "sigpc.registroDiario.registros"

export function loadBorrador(): RegistroDiarioDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RegistroDiarioDraft
    if (!parsed || typeof parsed !== "object") return null
    return {
      ordenId: parsed.ordenId ?? null,
      produccion: parsed.produccion ?? {
        referencia: "",
        programada: 0,
        producida: 0,
        buena: 0,
        rechazada: 0,
        reprocesada: 0,
        horaInicio: "",
        horaFin: "",
      },
      paradas: Array.isArray(parsed.paradas) ? parsed.paradas : [],
      checklist: parsed.checklist ?? {},
      materiasPrima: Array.isArray(parsed.materiasPrima) ? parsed.materiasPrima : [],
      defectos: Array.isArray(parsed.defectos) ? parsed.defectos : [],
      incidencias: Array.isArray(parsed.incidencias) ? parsed.incidencias : [],
      incidenciaOtroTexto: parsed.incidenciaOtroTexto ?? "",
      observaciones: parsed.observaciones ?? "",
      firmas: parsed.firmas ?? { operario: null, supervisor: null, inspectorCalidad: null },
      inicioISO: parsed.inicioISO ?? null,
    }
  } catch {
    return null
  }
}

export function saveBorrador(draft: RegistroDiarioDraft): void {
  try {
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft))
  } catch {
    // almacenamiento no disponible
  }
}

export function clearBorrador(): void {
  try {
    localStorage.removeItem(STORAGE_DRAFT)
  } catch {
    // ignorar
  }
}

export function listarRegistros(): RegistroDiarioCompleto[] {
  try {
    const raw = localStorage.getItem(STORAGE_REGISTROS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RegistroDiarioCompleto[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function registrarRegistro(registro: RegistroDiarioCompleto): void {
  try {
    const registros = listarRegistros().filter((r) => r.id !== registro.id)
    registros.push(registro)
    localStorage.setItem(STORAGE_REGISTROS, JSON.stringify(registros))
  } catch {
    // almacenamiento no disponible
  }
}

export function nuevoFolio(ordenId: string): string {
  const seq = (listarRegistros().length + 1).toString().padStart(4, "0")
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `RD-${fecha}-${ordenId.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}-${seq}`
}
