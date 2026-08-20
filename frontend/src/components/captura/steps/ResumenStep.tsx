import { CheckCircle2, ClipboardCheck, Flag, Package, Timer, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { checklistItems } from "@/config/captura"
import type { DemoProductionOrder } from "@/data/demo"
import type { CapturaDraft, CapturaTotals } from "@/lib/captura"
import { formatMinutes } from "@/lib/captura"
import { formatPercent } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface ResumenStepProps {
  draft: CapturaDraft
  orden: DemoProductionOrder | null
  totals: CapturaTotals
  error: string | null
  onObservaciones: (value: string) => void
  onFinalizar: () => void
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Package
  label: string
  value: string
  tone: "blue" | "green" | "red" | "amber" | "purple"
}) {
  const tones = {
    blue: "border-chart-1/25 bg-chart-1/8 text-chart-1",
    green: "border-chart-3/25 bg-chart-3/8 text-chart-3",
    red: "border-chart-5/25 bg-chart-5/8 text-chart-5",
    amber: "border-chart-4/25 bg-chart-4/8 text-chart-4",
    purple: "border-chart-2/25 bg-chart-2/8 text-chart-2",
  }
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}

export function ResumenStep({
  draft,
  orden,
  totals,
  error,
  onObservaciones,
  onFinalizar,
}: ResumenStepProps) {
  const checklistDone = checklistItems.filter((item) => draft.checklist[item.key]).length
  const eficiencia = totals.rendimiento * 100

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={Package}
          label="Producción total"
          value={`${totals.produccionTotal.toFixed(1)} ${orden?.unidad ?? ""}`.trim()}
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Buenas"
          value={`${totals.buena.toFixed(1)} ${orden?.unidad ?? ""}`.trim()}
          tone="green"
        />
        <StatCard
          icon={Trash2}
          label="Rechazos"
          value={`${totals.rechazada.toFixed(1)} ${orden?.unidad ?? ""}`.trim()}
          tone="red"
        />
        <StatCard
          icon={Timer}
          label="Tiempo improductivo"
          value={formatMinutes(totals.tiempoDetenidoMin)}
          tone="amber"
        />
        <StatCard
          icon={Flag}
          label="Eficiencia"
          value={formatPercent(eficiencia)}
          tone="purple"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Disponibilidad"
          value={formatPercent(totals.disponibilidad * 100)}
          tone="green"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-br from-chart-1/10 to-chart-2/10 p-5">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              OEE del turno
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums">
              {Math.round(totals.oee * 100)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Calidad: {formatPercent(totals.calidad * 100)} · Rendimiento: {formatPercent(eficiencia)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Verificación final
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-card px-2.5 py-1 font-medium">
              Preparación: {checklistDone}/{checklistItems.length}
            </span>
            <span className="rounded-full bg-card px-2.5 py-1 font-medium">
              Producciones: {draft.produccion.length}
            </span>
            <span className="rounded-full bg-card px-2.5 py-1 font-medium">
              Paradas: {draft.paradas.length}
            </span>
            <span className="rounded-full bg-card px-2.5 py-1 font-medium">
              Avance: {totals.avancePct.toFixed(0)}% de meta
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="obs-finales" className="text-sm font-medium">
          Observaciones finales
        </label>
        <Textarea
          id="obs-finales"
          value={draft.observacionesFinales}
          onChange={(e) => onObservaciones(e.target.value)}
          placeholder="Incidencias, recomendaciones o comentarios del turno (opcional)"
          className="min-h-24"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <Button size="lg" className="w-full sm:w-auto sm:min-w-64" onClick={onFinalizar}>
        <Flag className="mr-2 h-4 w-4" />
        Finalizar Producción
      </Button>
    </div>
  )
}