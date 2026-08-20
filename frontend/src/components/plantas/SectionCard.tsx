import { ArrowRight, Boxes, Clock3 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import type { Planta, SeccionProduccion } from "@/config/plantas"
import { rutaSeccion } from "@/config/plantas"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  planta: Planta
  seccion: SeccionProduccion
  index?: number
}

/** Tarjeta de sección / proceso de una planta */
export function SectionCard({ planta, seccion, index = 0 }: SectionCardProps) {
  const navigate = useNavigate()
  const Icon = seccion.icon
  const totalMaquinas = seccion.maquinas.length
  const habilitada = totalMaquinas > 0

  return (
    <button
      type="button"
      onClick={() => navigate(rutaSeccion(planta.id, seccion.id))}
      disabled={!habilitada}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-card transition-all duration-300 animate-fade-up",
        "hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        habilitada
          ? "hover:border-primary/25"
          : "cursor-not-allowed opacity-75 hover:shadow-card",
        index % 3 === 1 && "delay-75",
        index % 3 === 2 && "delay-150",
      )}
      aria-label={`Sección ${seccion.nombre} de ${planta.nombre}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-chart-1/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />

      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-chart-1/20 bg-chart-1/10 text-chart-1 transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        {!habilitada && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Clock3 className="h-3 w-3" />
            Próximamente
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
          {seccion.nombre}
          <ArrowRight
            className={cn(
              "h-4 w-4 text-primary transition-all duration-300",
              habilitada
                ? "opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100"
                : "hidden",
            )}
          />
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {seccion.descripcion}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-1.5 border-t pt-3.5 text-xs font-medium text-muted-foreground">
        <Boxes className="h-3.5 w-3.5" />
        {habilitada
          ? `${totalMaquinas} ${totalMaquinas === 1 ? "máquina" : "máquinas"}`
          : "Estructura preparada"}
      </div>
    </button>
  )
}