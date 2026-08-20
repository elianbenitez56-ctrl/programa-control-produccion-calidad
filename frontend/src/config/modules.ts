import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Factory,
  FileStack,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Package,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface ModuleDefinition {
  key: string
  name: string
  path: string
  description: string
  icon: LucideIcon
  /** Color de acento del módulo (se usa en iconos y badges) */
  accent: "blue" | "purple" | "green" | "amber" | "red"
  version: string
  status: "planificado" | "en desarrollo" | "activo"
  features: string[]
}

const accentVar = {
  blue: "text-chart-1 bg-chart-1/10 border-chart-1/20",
  purple: "text-chart-2 bg-chart-2/10 border-chart-2/20",
  green: "text-chart-3 bg-chart-3/10 border-chart-3/20",
  amber: "text-chart-4 bg-chart-4/10 border-chart-4/20",
  red: "text-chart-5 bg-chart-5/10 border-chart-5/20",
} as const

export function accentClasses(accent: ModuleDefinition["accent"]): string {
  return accentVar[accent]
}

export const modules: ModuleDefinition[] = [
  {
    key: "produccion",
    name: "Producción",
    path: "/produccion",
    description:
      "Órdenes de producción, programación de máquinas, reporte de producción y seguimiento en tiempo real.",
    icon: Factory,
    accent: "blue",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Órdenes de producción y estados",
      "Programación por máquina y turno",
      "Reporte de producción desde kiosko",
      "Seguimiento en tiempo real",
    ],
  },
  {
    key: "calidad",
    name: "Calidad",
    path: "/calidad",
    description:
      "Inspecciones, control estadístico de procesos, no conformidades y laboratorio.",
    icon: FlaskConical,
    accent: "purple",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Inspecciones de proceso y liberación",
      "Control estadístico (SPC)",
      "Gestión de no conformidades",
      "Resultados de laboratorio",
    ],
  },
  {
    key: "trazabilidad",
    name: "Trazabilidad",
    path: "/trazabilidad",
    description:
      "Rastreo de lotes, materiales y consumo en cada etapa del proceso.",
    icon: ScanLine,
    accent: "green",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Lotes y seriales por producto",
      "Consumo de materiales por orden",
      "Línea de vida del lote",
      "Rastreo hacia adelante y atrás",
    ],
  },
  {
    key: "inventario",
    name: "Inventario",
    path: "/inventario",
    description:
      "Existencias, ubicaciones, movimientos y valorización de materiales.",
    icon: Package,
    accent: "amber",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Existencias por ubicación",
      "Movimientos y ajustes",
      "Recepciones y salidas",
      "Conteos cíclicos",
    ],
  },
  {
    key: "reportes",
    name: "Reportes",
    path: "/reportes",
    description:
      "Reportes operativos, calidad, productividad y exportación a Excel y PDF.",
    icon: FileText,
    accent: "blue",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Reportes por módulo",
      "Exportación Excel y PDF",
      "Reportes programados",
      "Historial de generación",
    ],
  },
  {
    key: "indicadores",
    name: "Indicadores",
    path: "/indicadores",
    description:
      "OEE, disponibilidad, rendimiento, calidad, MTBF y MTTR por máquina.",
    icon: BarChart3,
    accent: "purple",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "OEE por máquina y línea",
      "MTBF / MTTR",
      "Tendencias por periodo",
      "Metas y umbrales",
    ],
  },
  {
    key: "usuarios",
    name: "Usuarios",
    path: "/usuarios",
    description:
      "Gestión de usuarios, roles, permisos y control de acceso por módulo.",
    icon: Users,
    accent: "green",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Usuarios y roles",
      "Permisos por módulo",
      "Sesiones activas",
      "Operarios por kiosko",
    ],
  },
  {
    key: "configuracion",
    name: "Configuración",
    path: "/configuracion",
    description:
      "Parámetros del sistema, plantas, áreas, máquinas, turnos y catálogos.",
    icon: Settings,
    accent: "amber",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Plantas, áreas y máquinas",
      "Turnos y calendario",
      "Kioskos y credenciales",
      "Parámetros generales",
    ],
  },
  {
    key: "auditoria",
    name: "Auditoría",
    path: "/auditoria",
    description:
      "Bitácora de eventos del sistema, cambios críticos y trazabilidad de acciones.",
    icon: ShieldCheck,
    accent: "red",
    version: "v0.1",
    status: "en desarrollo",
    features: [
      "Bitácora de eventos",
      "Cambios críticos",
      "Filtros por usuario y entidad",
      "Retención y exportación",
    ],
  },
]

export interface NavSection {
  label: string
  items: {
    label: string
    to: string
    icon: LucideIcon
    accent: ModuleDefinition["accent"]
    badge?: string
    /** Roles con acceso (RBAC). Si se omite, lo ve cualquier usuario autenticado. */
    roles?: string[]
    /** Permisos `recurso:accion` requeridos (alguno basta). */
    permisos?: string[]
  }[]
}

export const navSections: NavSection[] = [
  {
    label: "Navegación",
    items: [
      {
        label: "Inicio",
        to: "/inicio",
        icon: LayoutDashboard,
        accent: "blue",
      },
    ],
  },
  {
    label: "Plantas",
    items: [
      {
        label: "INAPEL",
        to: "/planta/inapel",
        icon: Factory,
        accent: "blue",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "MARFIL",
        to: "/planta/marfil",
        icon: Boxes,
        accent: "green",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
    ],
  },
  {
    label: "Registros",
    items: [
      {
        label: "Registros por Área",
        to: "/registros",
        icon: FileStack,
        accent: "blue",
        badge: "MES",
      },
    ],
  },
  {
    label: "Módulos",
    items: [
      {
        label: "Producción",
        to: "/produccion",
        icon: Factory,
        accent: "blue",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "Calidad",
        to: "/calidad",
        icon: FlaskConical,
        accent: "purple",
        roles: ["admin", "calidad", "supervisor", "auditoria"],
      },
      {
        label: "Trazabilidad",
        to: "/trazabilidad",
        icon: ScanLine,
        accent: "green",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "Inventario",
        to: "/inventario",
        icon: Package,
        accent: "amber",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "Reportes",
        to: "/reportes",
        icon: FileText,
        accent: "blue",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "Indicadores",
        to: "/indicadores",
        icon: BarChart3,
        accent: "purple",
        roles: ["admin", "supervisor", "gerencia", "auditoria"],
      },
      {
        label: "Usuarios",
        to: "/usuarios",
        icon: Users,
        accent: "green",
        roles: ["admin"],
      },
      {
        label: "Configuración",
        to: "/configuracion",
        icon: Settings,
        accent: "amber",
        roles: ["admin"],
      },
      {
        label: "Auditoría",
        to: "/auditoria",
        icon: ShieldCheck,
        accent: "red",
        roles: ["admin", "auditoria"],
      },
    ],
  },
]

export const activityTypeMeta = {
  orden: { icon: ClipboardCheck, accent: "blue" as const, label: "Órdenes" },
  inspeccion: { icon: FlaskConical, accent: "purple" as const, label: "Calidad" },
  no_conformidad: { icon: Activity, accent: "red" as const, label: "No conformidades" },
  reporte: { icon: FileText, accent: "green" as const, label: "Reportes" },
  sistema: { icon: Settings, accent: "amber" as const, label: "Sistema" },
}
