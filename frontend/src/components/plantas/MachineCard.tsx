import { ArrowRight, Cog, Gauge } from "lucide-react"
import { useNavigate } from "react-router-dom"

import type {
  Maquina,
  Planta,
  SeccionProduccion,
} from "@/config/plantas"
import { mesRutaBase } from "@/config/plantas"
import { cn } from "@/lib/utils"

interface MachineCardProps {
  planta: Planta
  seccion: SeccionProduccion
  maquina: Maquina
  index?: number
}

/** Tarjeta de máquina: al pulsarla abre el sistema MES de esa máquina */
export function MachineCard({ planta, seccion, maquina, index = 0 }: MachineCardProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() =>
        navigate(mesRutaBase(planta.id, seccion.id, maquina.id))
      }
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-card transition-all duration-300 animate-fade-up",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        index % 3 === 1 && "delay-75",
        index % 3 === 2 && "delay-150",
      )}
      aria-label={`Ingresar al sistema MES de ${maquina.nombre}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-chart-4/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-chart-1/20 bg-chart-1/10 text-chart-1 transition-transform duration-300 group-hover:scale-110">
          <Cog className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
          <Gauge className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
          {maquina.nombre}
          <ArrowRight
            className="h-4 w-4 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
          />
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {maquina.descripcion ?? seccion.nombre}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-3.5 text-xs">
        <span className="font-medium text-muted-foreground">
          {seccion.nombre} · {planta.nombre}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-primary transition-colors group-hover:text-primary/80">
          Ingresar MES
        </span>
      </div>
    </button>
  )
}