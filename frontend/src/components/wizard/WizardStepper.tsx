import { Check } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface WizardStepDef {
  key: string
  label: string
  icon: LucideIcon
}

interface WizardStepperProps {
  pasos: WizardStepDef[]
  actual: number
  completados: number[]
  onSelect: (index: number) => void
}

/** Stepper genérico de wizard con barra de progreso y % de avance */
export function WizardStepper({ pasos, actual, completados, onSelect }: WizardStepperProps) {
  const avance = Math.round(((actual - 1) / pasos.length) * 100)

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Progreso del registro
        </p>
        <p className="text-xs font-bold tabular-nums text-primary">{avance}%</p>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-4 transition-all duration-500 ease-out"
          style={{ width: `${avance}%` }}
        />
      </div>

      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        {pasos.map((paso, i) => {
          const Icon = paso.icon
          const isCurrent = actual === i + 1
          const isDone = completados.includes(i + 1)
          return (
            <button
              key={paso.key}
              type="button"
              onClick={() => onSelect(i + 1)}
              title={paso.label}
              className={cn(
                "group flex flex-1 items-center gap-2",
                i < pasos.length - 1 && "after:mx-1.5 after:h-px after:flex-1 after:rounded-full after:bg-border",
                isDone && "after:bg-chart-3/60",
              )}
            >
              <span className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCurrent
                      ? "border-chart-1 bg-chart-1/10 text-chart-1 ring-4 ring-chart-1/15"
                      : isDone
                        ? "border-chart-3 bg-chart-3/10 text-chart-3"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] font-semibold transition-colors",
                    isCurrent ? "text-foreground" : isDone ? "text-chart-3" : "text-muted-foreground",
                  )}
                >
                  {i + 1}. {paso.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}