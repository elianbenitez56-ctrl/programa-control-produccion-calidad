import { MessageSquareText } from "lucide-react"

import { Textarea } from "@/components/ui/textarea"

interface ObservacionesStepProps {
  valor: string
  onChange: (valor: string) => void
}

export function ObservacionesStep({ valor, onChange }: ObservacionesStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-chart-2/30 bg-chart-2/10 text-chart-2">
          <MessageSquareText className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Observaciones generales</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Campo obligatorio: incluya cualquier detalle relevante del turno (trabajo realizado,
            pendientes, recomendaciones para el siguiente turno).
          </p>
        </div>
      </div>
      <Textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej.: Se completó la orden OP-2024-0015 con avance al 100%. Se dejó setup listo para la siguiente orden..."
        rows={8}
        className="text-sm"
      />
      <p className="text-right text-xs font-medium text-muted-foreground">
        {valor.trim().length} caracteres
      </p>
    </div>
  )
}