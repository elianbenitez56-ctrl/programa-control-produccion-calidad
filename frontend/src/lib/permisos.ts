import { Factory } from "lucide-react"

import { navSections, type NavSection } from "@/config/modules"
import { areaAsignadaResuelta, esAccesoGlobal, rutaMiArea } from "@/config/usuarios"
import type { Usuario } from "@/types/auth"

/**
 * Módulo central RBAC del frontend.
 * La extensión para futuros roles se hace aquí y en `config/modules.ts`
 * (matriz de visibilidad), sin tocar la estructura de rutas ni el layout.
 */

export function rolPrincipal(user: Usuario | null): string | null {
  return user?.roles?.[0] ?? null
}

export function tenerRol(user: Usuario | null, rol: string): boolean {
  return (user?.roles ?? []).includes(rol)
}

export function tenerAlgunRol(user: Usuario | null, roles: string[]): boolean {
  return roles.some((rol) => tenerRol(user, rol))
}

export function puede(user: Usuario | null, permiso: string): boolean {
  return (user?.permisos ?? []).includes(permiso)
}

export function tieneAlgunPermiso(user: Usuario | null, permisos: string[]): boolean {
  return permisos.some((p) => puede(user, p))
}

export function etiquetaRol(user: Usuario | null): string {
  const rol = rolPrincipal(user)
  const nombres: Record<string, string> = {
    admin: "Administrador del sistema",
    operario: "Operario",
    supervisor: "Supervisor",
    calidad: "Inspector de calidad",
    gerencia: "Gerencia",
    auditoria: "Auditoría",
  }
  return (rol && nombres[rol]) ?? "Usuario SIGPC"
}

/** Filtra los ítems del menú según el rol/permisos del usuario. */
function itemVisible(
  item: { roles?: string[]; permisos?: string[] },
  user: Usuario | null,
): boolean {
  if (item.roles?.length && !tenerAlgunRol(user, item.roles)) return false
  if (item.permisos?.length && !tieneAlgunPermiso(user, item.permisos)) return false
  return true
}

/**
 * Navegación del sidebar adaptada al usuario:
 * - Operario: ve Inicio, "Mi área de trabajo" y Registros; el resto se oculta.
 * - Roles con acceso global: secciones según la matriz de `config/modules.ts`.
 */
export function navSectionsPara(user: Usuario | null): NavSection[] {
  const global = esAccesoGlobal(user)
  if (!global) {
    const miArea = areaAsignadaResuelta(user)
    const items: NavSection["items"] = [{ label: "Inicio", to: "/inicio", icon: Factory, accent: "blue" }]
    if (miArea) {
      items.push({
        label: "Mi área de trabajo",
        to: miArea.ruta,
        icon: Factory,
        accent: "blue",
      })
    }
    return [
      { label: "Navegación", items },
      ...navSections
        .filter((s) => s.label === "Registros")
        .map((s) => ({ ...s, items: s.items.filter((i) => itemVisible(i, user)) })),
    ]
  }

  return navSections
    .map((seccion) => ({
      ...seccion,
      items: seccion.items.filter((item) => itemVisible(item, user)),
    }))
    .filter((seccion) => seccion.items.length > 0)
}

/** Ruta de inicio por perfil (redirección tras login). */
export function rutaInicioPorRol(user: Usuario | null): string {
  if (!user) return "/login"
  if (esAccesoGlobal(user)) return "/inicio"
  return rutaMiArea(user) ?? "/inicio"
}