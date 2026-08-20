import { Check } from "lucide-react"

import { Textarea } from "@/components/ui/textarea"
import { checklistItems } from "@/config/captura"
import { cn } from "@/lib/utils"

interface ChecklistStepProps {
  checklist: Record<string, boolean>
  comentario: string
  onToggle: (key: string) => void
  onComentario: (value: string) => void
}

export function ChecklistStep({
  checklist,
  comentario,
  onToggle,
  onComentario,
}: ChecklistStepProps) {
  const done = checklistItems.filter((item) => checklist[item.key]).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Confirma que la preparación está completa
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
            done === checklistItems.length
              ? "bg-chart-3/15 text-chart-3"
              : "bg-muted text-muted-foreground",
          )}
        >
          {done} / {checklistItems.length}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {checklistItems.map((item) => {
          const checked = Boolean(checklist[item.key])
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggle(item.key)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                checked
                  ? "border-chart-3/40 bg-chart-3/5 shadow-card"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
                  checked
                    ? "border-chart-3 bg-chart-3 text-white"
                    : "border-muted-foreground/40 text-transparent",
                )}
              >
                <Check className="h-4 w-4" />
              </span>
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  checked ? "text-chart-3" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <label htmlFor="comentario-preparacion" className="text-sm font-medium">
          Comentarios
        </label>
        <Textarea
          id="comentario-preparacion"
          value={comentario}
          onChange={(e) => onComentario(e.target.value)}
          placeholder="Observaciones de la preparación (opcional)"
          className="min-h-20"
        />
      </div>
    </div>
  )
}