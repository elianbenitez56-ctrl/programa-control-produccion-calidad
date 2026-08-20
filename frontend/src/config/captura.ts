import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Flag,
  Gauge,
  LayoutTemplate,
  ListChecks,
  MoreHorizontal,
  Package,
  PackageX,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Wrench,
  Zap,
  Cog,
  type LucideIcon,
} from "lucide-react"

export interface CapturaStepDef {
  n: 1 | 2 | 3 | 4 | 5
  label: string
  title: string
  icon: LucideIcon
}

export const capturaSteps: CapturaStepDef[] = [
  { n: 1, label: "Orden", title: "Orden de producción", icon: ClipboardList },
  { n: 2, label: "Preparación", title: "Lista de preparación", icon: ListChecks },
  { n: 3, label: "Producción", title: "Registro de producción", icon: Gauge },
  { n: 4, label: "Paradas", title: "Tiempos improductivos", icon: Timer },
  { n: 5, label: "Resumen", title: "Finalizar producción", icon: Flag },
]

export interface ChecklistItemDef {
  key: string
  label: string
  icon: LucideIcon
}

export const checklistItems: ChecklistItemDef[] = [
  { key: "material", label: "Material disponible", icon: Package },
  { key: "maquina", label: "Máquina preparada", icon: Cog },
  { key: "herramientas", label: "Herramientas completas", icon: Wrench },
  { key: "calidad", label: "Calidad autorizó el inicio", icon: ShieldCheck },
  { key: "validada", label: "Orden validada", icon: ClipboardCheck },
]

export interface DowntimeReasonDef {
  key: string
  label: string
  icon: LucideIcon
}

export const downtimeReasons: DowntimeReasonDef[] = [
  { key: "cambio_formato", label: "Cambio de formato", icon: LayoutTemplate },
  { key: "cambio_referencia", label: "Cambio de referencia", icon: RefreshCw },
  { key: "falta_material", label: "Falta de material", icon: PackageX },
  { key: "danio_mecanico", label: "Daño mecánico", icon: Wrench },
  { key: "danio_electrico", label: "Daño eléctrico", icon: Zap },
  { key: "mantenimiento", label: "Mantenimiento", icon: Settings },
  { key: "limpieza", label: "Limpieza", icon: Sparkles },
  { key: "espera_calidad", label: "Espera de calidad", icon: Clock },
  { key: "ajuste", label: "Ajuste", icon: SlidersHorizontal },
  { key: "otro", label: "Otro", icon: MoreHorizontal },
]

export function reasonLabel(key: string): string {
  return downtimeReasons.find((r) => r.key === key)?.label ?? key
}

export const successIcon = CheckCircle2
