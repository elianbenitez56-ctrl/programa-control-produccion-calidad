import { ArrowRight, Boxes, Layers3 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import type { Planta } from "@/config/plantas"
import { cn } from "@/lib/utils"

const plantThemes: Record<
  string,
  { gradient: string; glow: string; accent: string; chip: string }
> = {
  inapel: {
    gradient:
      "linear-gradient(135deg, hsl(232 62% 12%) 0%, hsl(232 62% 24%) 45%, hsl(213 60% 38%) 100%)",
    glow: "radial-gradient(600px 320px at 85% -10%, hsl(27 90% 44% / 0.35), transparent 60%)",
    accent: "bg-warning",
    chip: "bg-white/10 text-white",
  },
  marfil: {
    gradient:
      "linear-gradient(135deg, hsl(200 62% 10%) 0%, hsl(196 58% 22%) 45%, hsl(187 54% 32%) 100%)",
    glow: "radial-gradient(600px 320px at 85% -10%, hsl(160 84% 39% / 0.30), transparent 60%)",
    accent: "bg-chart-3",
    chip: "bg-white/10 text-white",
  },
}

const gridPattern =
  "url(\"data:image/svg+xml,%3Csvg width='44' height='44' viewBox='0 0 44 44' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M44 0H0v44' fill='none' stroke='%23ffffff' stroke-opacity='0.06'/%3E%3C/svg%3E\")"

interface PlantCardProps {
  planta: Planta
  index?: number
}

/** Tarjeta grande de selección de planta (pantalla principal) */
export function PlantCard({ planta, index = 0 }: PlantCardProps) {
  const navigate = useNavigate()
  const Icon = planta.icon
  const theme = plantThemes[planta.id] ?? plantThemes.inapel

  const totalMaquinas = planta.secciones.reduce((sum, s) => sum + s.maquinas.length, 0)

  return (
    <button
      type="button"
      onClick={() => navigate(`/planta/${planta.id}`)}
      className={cn(
        "group relative flex min-h-72 flex-col overflow-hidden rounded-2xl text-left shadow-card transition-all duration-300 animate-fade-up",
        "hover:-translate-y-1.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        index % 2 === 1 && "delay-150",
      )}
      style={{ background: theme.gradient }}
      aria-label={`Ingresar a planta ${planta.nombre}`}
    >
      {/* Textura industrial y resplandor */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ backgroundImage: gridPattern }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: theme.glow }}
      />

      {/* Marca de agua del icono */}
      <Icon
        aria-hidden
        strokeWidth={1}
        className="pointer-events-none absolute -bottom-8 -right-8 h-56 w-56 text-white/[0.07] transition-transform duration-500 group-hover:scale-110 group-hover:text-white/10"
      />

      <div className="relative flex flex-1 flex-col p-7 sm:p-9">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em]",
            theme.chip,
          )}
        >
          <Icon className="h-4 w-4" />
          {planta.nombre}
        </span>

        <div className="mt-auto pt-10">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {planta.nombre}
          </h2>
          <p className="mt-1 text-sm font-medium text-white/80">{planta.razonSocial}</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
            {planta.descripcion}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
              <Layers3 className="h-3.5 w-3.5" />
              {planta.secciones.length} procesos
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
              <Boxes className="h-3.5 w-3.5" />
              {totalMaquinas} máquinas
            </span>
          </div>
        </div>
      </div>

      {/* CTA inferior */}
      <div className="relative flex items-center justify-between border-t border-white/10 px-7 py-4 sm:px-9">
        <span className="text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
          Ingresar al sistema MES
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-white transition-all duration-300",
            "group-hover:translate-x-1 group-hover:scale-110",
            theme.accent,
          )}
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  )
}