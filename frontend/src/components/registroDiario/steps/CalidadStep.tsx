import { BadgeCheck, ClipboardCheck } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import type { ChecklistCalidadDef } from "@/config/registroDiario"
import { cn } from "@/lib/utils"

interface CalidadStepProps {
  items: ChecklistCalidadDef[]
  checklist: Record<string, boolean>
  onToggle: (key: string) => void
}

export function CalidadStep({ items, checklist, onToggle }: CalidadStepProps) {
  const completadas = items.filter((item) => checklist[item.key]).length
  const total = items.length

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Confirme cada punto del chequeo de calidad antes de cerrar el turno.
        </p>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
            completadas === total
              ? "bg-chart-3/15 text-chart-3"
              : "bg-chart-4/10 text-chart-4",
          )}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {completadas} / {total} verificados
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const checked = Boolean(checklist[item.key])
          const Icon = item.icon
          return (
            <label
              key={item.key}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-sm transition-all duration-200",
                checked
                  ? "border-chart-3/50 bg-chart-3/[0.06]"
                  : "hover:border-primary/30 hover:bg-accent/40",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(item.key)}
                className="h-5 w-5"
              />
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  checked
                    ? "border-chart-3/30 bg-chart-3/10 text-chart-3"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
              {checked && <BadgeCheck className="ml-auto h-4 w-4 shrink-0 text-chart-3" />}
            </label>
          )
        })}
      </div>
    </div>
  )
}