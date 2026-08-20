import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  Gauge,
  ShieldCheck,
  Timer,
  TrendingUp,
  Package,
  type LucideIcon,
} from "lucide-react"

import type { DemoKpi } from "@/data/demo"
import { cn } from "@/lib/utils"

/** KPI del dashboard: los datos reales no siempre tienen comparativo o serie. */
export type DashboardKpi = Omit<DemoKpi, "trend" | "spark"> & {
  trend?: number
  spark?: number[]
  trendLabel?: string
}

const kpiIcons: Record<string, LucideIcon> = {
  ordenes: ClipboardList,
  produccion: Package,
  inspecciones: FlaskConical,
  nc: AlertTriangle,
  oee: Gauge,
  disponibilidad: Timer,
  calidad: ShieldCheck,
  performance: TrendingUp,
}

const accentTint: Record<string, string> = {
  blue: "bg-chart-1/10 text-chart-1",
  purple: "bg-chart-2/10 text-chart-2",
  green: "bg-chart-3/10 text-chart-3",
  amber: "bg-chart-4/10 text-chart-4",
  red: "bg-chart-5/10 text-chart-5",
}

const sparkColor: Record<string, string> = {
  blue: "bg-chart-1",
  purple: "bg-chart-2",
  green: "bg-chart-3",
  amber: "bg-chart-4",
  red: "bg-chart-5",
}

function SparkBars({ kpi }: { kpi: DashboardKpi }) {
  const spark = kpi.spark
  if (!spark || spark.length < 2) return null
  const max = Math.max(...spark)
  const color = sparkColor[kpi.accent] ?? "bg-chart-1"
  return (
    <div className="mt-4 flex h-8 w-full items-end gap-1">
      {spark.map((v, i) => {
        const last = i === spark.length - 1
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t-sm",
              color,
              last ? "opacity-100" : "opacity-40",
            )}
            style={{ height: `${Math.max(15, (v / max) * 100)}%` }}
          />
        )
      })}
    </div>
  )
}

export function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const positive = (kpi.trend ?? 0) >= 0
  const good = kpi.trendUpIsGood ? positive : !positive
  const Icon = kpiIcons[kpi.key] ?? TrendingUp

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-card">
      <div className="absolute -mr-4 -mt-4 right-0 top-0 h-16 w-16 rounded-bl-full bg-primary opacity-[0.05] transition-transform duration-300 group-hover:scale-110" />
      <div className="relative flex items-start justify-between">
        <span className="text-label-md font-semibold uppercase tracking-wider text-muted-foreground">
          {kpi.label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            accentTint[kpi.accent] ?? "bg-chart-1/10 text-chart-1",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
      </div>
      <div className="relative mt-1">
        <span className="text-[32px] font-bold leading-tight tracking-tight text-foreground">
          {kpi.value}
          {kpi.unit && (
            <span className="ml-1 text-xl font-semibold text-muted-foreground">
              {kpi.unit}
            </span>
          )}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          {kpi.trend !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-semibold",
                good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(kpi.trend)}%
            </span>
          )}
          {kpi.trend !== undefined && (
            <span className="text-xs text-muted-foreground">
              {kpi.trendLabel ?? "vs periodo anterior"}
            </span>
          )}
        </div>
      </div>
      <SparkBars kpi={kpi} />
    </div>
  )
}