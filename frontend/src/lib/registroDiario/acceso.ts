import { getMaquina } from "@/config/plantas"
import { areaAsignada, esAccesoGlobal } from "@/config/usuarios"
import type { Usuario } from "@/types/auth"
import type { RegistroDiarioCompleto } from "@/types/registroDiario"

/**
 * Control de acceso a los registros por rol:
 * - admin / supervisor / gerencia / auditoría: todas las áreas de la planta.
 * - operario: solo los registros de su área/máquina o los suyos propios.
 */
export function registrosVisibles(
  registros: RegistroDiarioCompleto[],
  user: Usuario | null,
): RegistroDiarioCompleto[] {
  if (!user) return []
  if (esAccesoGlobal(user)) return registros

  const asignacion = areaAsignada(user)
  const maquinaNombre = asignacion
    ? getMaquina(asignacion.plantaId, asignacion.seccionId, asignacion.maquinaId)?.nombre
    : undefined
  const operarioNombre = `${user.nombre} ${user.apellidos}`.trim()

  return registros.filter((r) => {
    if (maquinaNombre && r.autocompletado.maquinaNombre === maquinaNombre) return true
    return r.autocompletado.operario === operarioNombre
  })
}