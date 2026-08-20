import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CapturaStep } from "@/lib/captura"

interface StepShellProps {
  step: CapturaStep
  title: string
  subtitle: string
  canContinue: boolean
  onBack: () => void
  onNext: () => void
  continueLabel?: string
  hideContinue?: boolean
  children: ReactNode
}

export function StepShell({
  step,
  title,
  subtitle,
  canContinue,
  onBack,
  onNext,
  continueLabel = "Continuar",
  hideContinue,
  children,
}: StepShellProps) {
  return (
    <Card className="overflow-hidden shadow-card" key={step}>
      <div className="border-b bg-muted/30 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Paso {step} de 5
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <CardContent className="animate-fade-up p-6">{children}</CardContent>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-4">
        <Button variant="outline" onClick={onBack} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
        {!hideContinue && (
          <Button onClick={onNext} disabled={!canContinue} className="min-w-[140px]">
            {continueLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}