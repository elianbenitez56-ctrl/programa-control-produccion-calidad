import {
  CheckCircle2,
  Clock,
  Package,
  PackageX,
  Timer,
  TrendingUp,
} from "lucide-react"

import type { CierreTotals } from "@/lib/cierre"
import { formatMinutes } from "@/lib/captura"
import { cn } from "@/lib/utils"

function ResumenRow({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Clock
  label: string
  value: string
  tone?: "default" | "good" | "warn" | "bad"
}) {
  const tones = {
    default: "text-foreground",
    good: "text-chart-3",
    warn: "text-chart-4",
    bad: "text-chart-5",
  }
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40",
          tones[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-bold tabular-nums", tones[tone])}>{value}</p>
      </div>
    </div>
  )
}

export function ResumenCierre({ totals }: { totals: CierreTotals }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Resumen en vivo</p>
      </div>
      <div className="divide-y divide-border/60 px-5">
        <ResumenRow
          icon={Package}
          label="Producción registrada"
          value={`${totals.produccionRegistrada.toFixed(1)} t`}
          tone={totals.produccionRegistrada > 0 ? "good" : "default"}
        />
        <ResumenRow
          icon={CheckCircle2}
          label="Buenas"
          value={`${totals.buena.toFixed(1)} t`}
          tone={totals.buena > 0 ? "good" : "default"}
        />
        <ResumenRow
          icon={PackageX}
          label="Rechazos"
          value={`${totals.rechazada.toFixed(1)} t`}
          tone={totals.rechazada > 0 ? "bad" : "default"}
        />
        <ResumenRow
          icon={Timer}
          label="Tiempo improductivo total"
          value={formatMinutes(totals.tiempoDetenidoMin)}
          tone={totals.tiempoDetenidoMin > 0 ? "warn" : "default"}
        />
        <ResumenRow
          icon={Clock}
          label="Cantidad de paradas"
          value={String(totals.cantidadParadas)}
        />
        <ResumenRow
          icon={Clock}
          label="Tiempo del turno"
          value={formatMinutes(totals.tiempoTurnoMin)}
        />
      </div>
      <div className="border-t bg-muted/30 px-5 py-3 text-[11px] text-muted-foreground">
        Los tiempos y totales se actualizan automáticamente mientras diligencias el cierre.
      </div>
    </div>
  )
}