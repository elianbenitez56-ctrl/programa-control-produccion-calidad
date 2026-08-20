import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface WizardStepShellProps {
  paso: number
  total: number
  title: string
  subtitle: string
  canContinue: boolean
  onBack: () => void
  onNext: () => void
  continueLabel?: string
  hideContinue?: boolean
  children: ReactNode
}

/** Shell genérico de paso de wizard (título, contenido y navegación) */
export function WizardStepShell({
  paso,
  total,
  title,
  subtitle,
  canContinue,
  onBack,
  onNext,
  continueLabel = "Continuar",
  hideContinue,
  children,
}: WizardStepShellProps) {
  return (
    <Card className="overflow-hidden shadow-card" key={paso}>
      <div className="border-b bg-muted/30 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Paso {paso} de {total}
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <CardContent className="animate-fade-up p-6">{children}</CardContent>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-4">
        <Button variant="outline" onClick={onBack} disabled={paso === 1}>
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