import {
  BarChart3,
  ClipboardList,
  Factory,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ScrollText,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react"

/**
 * Módulos del sistema MES por máquina.
 * Se renderizan bajo la base /mes/:planta/:seccion/:maquina.
 */

export interface MesModuleDef {
  key: string
  label: string
  /** Segmento relativo a la base de la máquina ("" = dashboard) */
  segment: string
  icon: LucideIcon
}

export const mesModules: MesModuleDef[] = [
  { key: "dashboard", label: "Dashboard", segment: "", icon: LayoutDashboard },
  { key: "ordenes", label: "Orden de Producción", segment: "ordenes", icon: ClipboardList },
  { key: "produccion", label: "Producción", segment: "produccion", icon: Factory },
  { key: "calidad", label: "Calidad", segment: "calidad", icon: FlaskConical },
  { key: "paradas", label: "Paradas", segment: "paradas", icon: Timer },
  { key: "mantenimiento", label: "Mantenimiento", segment: "mantenimiento", icon: Wrench },
  { key: "registro-diario", label: "Registro Diario", segment: "registro-diario", icon: ScrollText },
  { key: "reportes", label: "Reportes", segment: "reportes", icon: FileText },
  { key: "indicadores", label: "Indicadores", segment: "indicadores", icon: BarChart3 },
]

/** Ruta completa de un módulo MES a partir de la base de la máquina */
export function mesModuleRuta(base: string, segment: string): string {
  return segment ? `${base}/${segment}` : base
}