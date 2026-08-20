import {
  CalendarDays,
  ChevronRight,
  Clock,
  Factory,
  Gauge,
  Package,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react"

import type { DemoProductionOrder } from "@/data/demo"
import { useAuth } from "@/contexts/AuthContext"
import type { CapturaDraft, CapturaTotals } from "@/lib/captura"
import { formatMinutes } from "@/lib/captura"
import { cn } from "@/lib/utils"

interface SidePanelProps {
  draft: CapturaDraft
  orden: DemoProductionOrder | null
  totals: CapturaTotals
  finalizada: boolean
}

type Estado = "sin_iniciar" | "en_proceso" | "en_pausa" | "finalizada"

function estadoDe(draft: CapturaDraft, finalizada: boolean): Estado {
  if (finalizada) return "finalizada"
  if (draft.paradas.some((p) => !p.fin)) return "en_pausa"
  if (draft.inicioISO) return "en_proceso"
  return "sin_iniciar"
}

const estadoMeta: Record<Estado, { label: string; dot: string; text: string }> = {
  sin_iniciar: { label: "Sin iniciar", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  en_proceso: { label: "En proceso", dot: "bg-chart-1", text: "text-chart-1" },
  en_pausa: { label: "En pausa", dot: "bg-chart-4", text: "text-chart-4" },
  finalizada: { label: "Finalizada", dot: "bg-chart-3", text: "text-chart-3" },
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof UserRound
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("block truncate text-sm font-semibold", mono && "tabular-nums")}>
          {value}
        </span>
      </span>
    </div>
  )
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-chart-1 transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function OeeRing({ value }: { value: number }) {
  const pct = Math.min(100, Math.round(value * 100))
  const color =
    pct >= 85 ? "hsl(var(--chart-3))" : pct >= 70 ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))"
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="hsl(var(--muted))" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value))}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{pct}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          OEE
        </span>
      </div>
    </div>
  )
}

export function SidePanel({ draft, orden, totals, finalizada }: SidePanelProps) {
  const { user } = useAuth()
  const estado = estadoDe(draft, finalizada)
  const meta = estadoMeta[estado]

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {estado === "en_proceso" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-60" />
            )}
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", meta.dot)} />
          </span>
          <p className="text-sm font-semibold">Captura en vivo</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            meta.text,
            "bg-muted",
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {orden ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-chart-1/10 text-chart-1">
                <Factory className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight">{orden.id}</p>
                <p className="truncate text-xs text-muted-foreground">{orden.producto}</p>
              </div>
            </div>

            <div className="grid gap-2">
              <InfoRow icon={UserRound} label="Operario" value={`${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim()} />
              <InfoRow icon={Factory} label="Máquina" value={orden.maquina} />
              <InfoRow icon={Clock} label="Turno" value={orden.turno} />
              <InfoRow icon={CalendarDays} label="Fecha" value={orden.fecha} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tiempo transcurrido
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {formatMinutes(totals.tiempoTranscurridoMin)}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3 text-center",
                  totals.tiempoDetenidoMin > 0
                    ? "border-chart-4/30 bg-chart-4/10"
                    : "bg-muted/30",
                )}
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tiempo detenido
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-lg font-bold tabular-nums",
                    totals.tiempoDetenidoMin > 0 && "text-chart-4",
                  )}
                >
                  {formatMinutes(totals.tiempoDetenidoMin)}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  Producción acumulada
                </span>
                <span className="font-bold tabular-nums">
                  {totals.produccionTotal.toFixed(1)} / {totals.meta} {orden.unidad}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    totals.avancePct >= 100 ? "bg-chart-3" : "bg-chart-1",
                  )}
                  style={{ width: `${Math.min(100, totals.avancePct)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                Avance {totals.avancePct.toFixed(0)}%
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
              <OeeRing value={totals.oee} />
              <div className="min-w-0 flex-1 space-y-3">
                <MiniBar label="Disponibilidad" value={totals.disponibilidad} />
                <MiniBar label="Rendimiento" value={totals.rendimiento} />
                <MiniBar label="Calidad" value={totals.calidad} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground">
              <Gauge className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold">Sin orden seleccionada</p>
              <p className="mx-auto mt-1 max-w-[220px] text-xs text-muted-foreground">
                Selecciona una orden de producción para iniciar la captura
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/30 px-5 py-3 text-[11px] text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-chart-3" />
        Los indicadores se calculan automáticamente
        <ChevronRight className="ml-auto h-3.5 w-3.5" />
      </div>
    </div>
  )
}

export function PanelChip({ draft, orden, totals, finalizada }: SidePanelProps) {
  const estado = estadoDe(draft, finalizada)
  const meta = estadoMeta[estado]
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border bg-card px-3 py-2 shadow-card lg:hidden">
      <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.text, "bg-muted")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        {meta.label}
      </span>
      {orden && (
        <>
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
            {orden.id}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            <Timer className="mr-1 inline h-3 w-3" />
            {formatMinutes(totals.tiempoTranscurridoMin)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            <Package className="mr-1 inline h-3 w-3" />
            {totals.produccionTotal.toFixed(1)}/{totals.meta} {orden.unidad}
          </span>
          <span className="shrink-0 text-xs font-semibold text-chart-1">
            OEE {Math.round(totals.oee * 100)}%
          </span>
        </>
      )}
    </div>
  )
}

export function EstadoBadge({
  draft,
  finalizada,
}: {
  draft: CapturaDraft
  finalizada: boolean
}) {
  const estado = estadoDe(draft, finalizada)
  const meta = estadoMeta[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.text,
        "bg-muted",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}