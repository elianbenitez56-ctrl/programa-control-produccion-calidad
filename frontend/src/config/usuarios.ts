import type { Usuario } from "@/types/auth"
import { getPlanta, getSeccion, getMaquina, mesRutaBase } from "@/config/plantas"

export interface AreaAsignada {
  plantaId: string
  seccionId: string
  maquinaId: string
  cargo: string
  supervisor: string
}

/**
 * Mapeo demo de respaldo: se usa SOLO si el usuario autenticado no trae la
 * asignación del backend (planta/área/máquina). El backend (/auth/me) es la
 * fuente de verdad de la asignación del puesto.
 */
const areasPorUsuario: Record<string, AreaAsignada> = {
  admin: {
    plantaId: "inapel",
    seccionId: "litografia",
    maquinaId: "sm-74",
    cargo: "Administrador",
    supervisor: "J. Torres",
  },
  operario1: {
    plantaId: "inapel",
    seccionId: "convertidoras",
    maquinaId: "chm-01",
    cargo: "Operario",
    supervisor: "J. Torres",
  },
}

function cargoPorRol(user: Usuario | null): string {
  const rol = user?.roles?.[0]
  const nombres: Record<string, string> = {
    admin: "Administrador",
    operario: "Operario",
    supervisor: "Supervisor",
    calidad: "Inspector de Calidad",
    gerencia: "Gerencia",
    auditoria: "Auditoría",
  }
  return (rol && nombres[rol]) ?? rol ?? "Colaborador"
}

/** Área de trabajo asignada al usuario (null si no está catalogada) */
export function areaAsignada(user: Usuario | null): AreaAsignada | null {
  if (!user) return null
  if (user.planta && user.area && user.maquina) {
    return {
      plantaId: user.planta,
      seccionId: user.area,
      maquinaId: user.maquina,
      cargo: cargoPorRol(user),
      supervisor: user.supervisor ?? "",
    }
  }
  return areasPorUsuario[user.usuario] ?? null
}

/**
 * Roles con consulta global: admin, supervisor (todas las áreas), gerencia y
 * auditoría. El operario solo ve su propia área/máquina.
 */
export function esAccesoGlobal(user: Usuario | null): boolean {
  if (!user) return false
  const roles = user.roles ?? []
  return ["admin", "supervisor", "gerencia", "auditoria"].some((r) => roles.includes(r))
}

/** Ruta directa al Registro Diario del área asignada al operario */
export function rutaMiArea(user: Usuario | null): string | null {
  const area = areaAsignada(user)
  if (!area) return null
  const base = mesRutaBase(area.plantaId, area.seccionId, area.maquinaId)
  return `${base}/registro-diario`
}

/** Nombres resueltos del área asignada (para tarjetas) */
export function areaAsignadaResuelta(user: Usuario | null) {
  const area = areaAsignada(user)
  if (!area) return null
  const planta = getPlanta(area.plantaId)
  const seccion = getSeccion(area.plantaId, area.seccionId)
  const maquina = getMaquina(area.plantaId, area.seccionId, area.maquinaId)
  if (!planta || !seccion || !maquina) return null
  return {
    plantaNombre: planta.nombre,
    seccionNombre: seccion.nombre,
    maquinaNombre: maquina.nombre,
    cargo: area.cargo,
    supervisor: area.supervisor,
    ruta: `${mesRutaBase(area.plantaId, area.seccionId, area.maquinaId)}/registro-diario`,
  }
}