import { Check } from "lucide-react"

import { capturaSteps, type CapturaStepDef } from "@/config/captura"
import type { CapturaStep } from "@/lib/captura"
import { cn } from "@/lib/utils"

interface StepperProps {
  current: CapturaStep
  completed: CapturaStep[]
  onSelect: (step: CapturaStep) => void
}

export function Stepper({ current, completed, onSelect }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      {capturaSteps.map((step, i) => (
        <StepItem
          key={step.n}
          step={step}
          index={i}
          total={capturaSteps.length}
          isCurrent={current === step.n}
          isDone={completed.includes(step.n)}
          onClick={() => onSelect(step.n)}
        />
      ))}
    </div>
  )
}

function StepItem({
  step,
  index,
  total,
  isCurrent,
  isDone,
  onClick,
}: {
  step: CapturaStepDef
  index: number
  total: number
  isCurrent: boolean
  isDone: boolean
  onClick: () => void
}) {
  const Icon = step.icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={step.title}
      className={cn(
        "group flex flex-1 items-center gap-3",
        index < total - 1 && "after:mx-2 after:h-px after:flex-1 after:rounded-full after:bg-border sm:after:mx-3",
        isDone && "after:bg-chart-3/60",
      )}
    >
      <span className="flex flex-col items-center gap-1.5 sm:flex-row">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
            isCurrent
              ? "border-chart-1 bg-chart-1/10 text-chart-1 ring-4 ring-chart-1/15"
              : isDone
                ? "border-chart-3 bg-chart-3/10 text-chart-3"
                : "border-border bg-card text-muted-foreground group-hover:border-primary/40",
          )}
        >
          {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <span
          className={cn(
            "hidden text-xs font-semibold transition-colors lg:block",
            isCurrent ? "text-foreground" : isDone ? "text-chart-3" : "text-muted-foreground",
          )}
        >
          <span className="mr-1 hidden text-muted-foreground/70 sm:inline">{index + 1}.</span>
          {step.label}
        </span>
      </span>
    </button>
  )
}