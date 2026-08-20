import { Boxes, CalendarDays, Clock3, Factory, UserRound } from "lucide-react"

import type { Maquina, Planta, SeccionProduccion } from "@/config/plantas"
import { useAuth } from "@/contexts/AuthContext"
import { todayLong } from "@/lib/formatters"
import { turnoActual } from "@/lib/turnos"

export interface MesContextBarProps {
  planta: Planta
  seccion: SeccionProduccion
  maquina: Maquina
}

interface ChipProps {
  icon: typeof Factory
  label: string
  value: string
  highlight?: boolean
}

function Chip({ icon: Icon, label, value, highlight }: ChipProps) {
  return (
    <span className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
      <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-xs font-bold text-primary"
            : "text-xs font-semibold"
        }
      >
        {value}
      </span>
    </span>
  )
}

/**
 * Barra de contexto global del MES: Planta · Sección · Máquina ·
 * Operario · Fecha · Turno. Estos son los filtros globales que
 * acompañan a todo registro de la sesión.
 */
export function MesContextBar({ planta, seccion, maquina }: MesContextBarProps) {
  const { user } = useAuth()
  const operario = `${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim()

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 shadow-card">
      <span className="flex items-center gap-2 px-1.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Factory className="h-4 w-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-xs font-bold uppercase tracking-wide">Sesión MES</span>
          <span className="block text-[11px] text-muted-foreground">{todayLong()}</span>
        </span>
      </span>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Chip icon={Factory} label="Planta" value={planta.nombre} highlight />
        <Chip icon={Boxes} label="Sección" value={seccion.nombre} />
        <Chip icon={Boxes} label="Máquina" value={maquina.nombre} highlight />
        <Chip icon={UserRound} label="Operario" value={operario} />
        <Chip icon={Clock3} label="Turno" value={turnoActual().label} />
        <Chip icon={CalendarDays} label="Fecha" value={todayLong()} />
      </div>
    </div>
  )
}