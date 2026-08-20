import { AlertCircle } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { incidenciasItems } from "@/config/registroDiario"
import { cn } from "@/lib/utils"

interface IncidenciasStepProps {
  marcadas: string[]
  otroTexto: string
  onToggle: (label: string) => void
  onChangeOtroTexto: (texto: string) => void
}

export function IncidenciasStep({ marcadas, otroTexto, onToggle, onChangeOtroTexto }: IncidenciasStepProps) {
  const otras = incidenciasItems.filter((i) => i !== "Otro")
  const otroMarcado = marcadas.includes("Otro")

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Marque las incidencias ocurridas en el turno (opcional).
        </p>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
            marcadas.length > 0 ? "bg-chart-4/10 text-chart-4" : "bg-muted text-muted-foreground",
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {marcadas.length} incidencia{marcadas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {otras.map((item) => {
          const marcada = marcadas.includes(item)
          return (
            <label
              key={item}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-sm transition-all duration-200",
                marcada
                  ? "border-chart-4/50 bg-chart-4/[0.06]"
                  : "hover:border-primary/30 hover:bg-accent/40",
              )}
            >
              <Checkbox
                checked={marcada}
                onCheckedChange={() => onToggle(item)}
                className="h-5 w-5"
              />
              <span className="text-sm font-medium text-foreground">{item}</span>
            </label>
          )
        })}
      </div>

      <div
        className={cn(
          "rounded-xl border bg-card p-4 shadow-sm transition-colors",
          otroMarcado ? "border-chart-4/50" : "border-border",
        )}
      >
        <label className="flex cursor-pointer items-center gap-3">
          <Checkbox
            checked={otroMarcado}
            onCheckedChange={() => onToggle("Otro")}
            className="h-5 w-5"
          />
          <span className="text-sm font-semibold">Otro</span>
        </label>
        {otroMarcado && (
          <Textarea
            value={otroTexto}
            onChange={(e) => onChangeOtroTexto(e.target.value)}
            placeholder="Describa la incidencia no contemplada en la lista..."
            className="mt-3"
            rows={2}
          />
        )}
      </div>
    </div>
  )
}