import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface MesModuleShellProps {
  icon: LucideIcon
  title: string
  description: string
  children?: ReactNode
}

/** Estructura común de los módulos MES en preparación/demo */
export function MesModuleShell({
  icon: Icon,
  title,
  description,
  children,
}: MesModuleShellProps) {
  return (
    <div className="space-y-6">
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-chart-2/10 blur-3xl" />
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-chart-2/20 bg-chart-2/10 text-chart-2 shadow-card">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {children}

      <div className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-chart-2" />
        <p>
          Módulo en preparación. La vista mostrada usa datos locales de demostración y se
          conectará a las APIs del backend cuando esté disponible.
        </p>
      </div>
    </div>
  )
}