import { PencilLine, ShieldCheck, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { pct } from "@/lib/registroDiario/compute"
import { cn } from "@/lib/utils"
import type { ProduccionRegistro, RegistroAutocompletado } from "@/types/registroDiario"

interface ProduccionStepProps {
  auto: RegistroAutocompletado
  produccion: ProduccionRegistro
  onChange: (produccion: ProduccionRegistro) => void
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export function ProduccionStep({ auto, produccion, onChange }: ProduccionStepProps) {
  const set = (patch: Partial<ProduccionRegistro>) => onChange({ ...produccion, ...patch })

  const total = produccion.producida
  const calidad = total > 0 ? pct(produccion.buena / total) : 0
  const rendimiento = produccion.programada > 0 ? pct(total / produccion.programada) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl border bg-chart-3/10 px-4 py-3">
        <PencilLine className="h-4 w-4 shrink-0 text-chart-3" />
        <p className="text-xs font-medium text-chart-3">
          Cantidades prellenadas desde la orden y el cierre; ajústelas a lo realmente producido
          en el turno.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
        <div className="sm:col-span-2 xl:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            Orden · productor · referencia
          </p>
        </div>
        <Valor readonly label="Orden de producción" value={auto.ordenId || "—"} />
        <Valor readonly label="Producto" value={auto.producto} />
        <Valor readonly label="Fecha / Turno" value={`${auto.fecha} · ${auto.turno}`} />
        <Campo label="Referencia">
          <Input
            value={produccion.referencia}
            onChange={(e) => set({ referencia: e.target.value })}
            placeholder={auto.referencia || "Ingrese la referencia"}
            className="h-9"
          />
        </Campo>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          Cantidades ({auto.unidad})
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Campo label="Cantidad programada">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={produccion.programada}
              onChange={(e) => set({ programada: Number(e.target.value) })}
              className="h-9"
            />
          </Campo>
          <Campo label="Cantidad producida">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={produccion.producida}
              onChange={(e) => set({ producida: Number(e.target.value) })}
              className="h-9"
            />
          </Campo>
          <Campo label="Cantidad buena">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={produccion.buena}
              onChange={(e) => set({ buena: Number(e.target.value) })}
              className="h-9"
            />
          </Campo>
          <Campo label="Cantidad rechazada">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={produccion.rechazada}
              onChange={(e) => set({ rechazada: Number(e.target.value) })}
              className="h-9"
            />
          </Campo>
          <Campo label="Cantidad reprocesada">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={produccion.reprocesada}
              onChange={(e) => set({ reprocesada: Number(e.target.value) })}
              className="h-9"
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MiniIndicador
            icon={ShieldCheck}
            label="Calidad"
            valor={`${calidad}%`}
            tone="success"
          />
          <MiniIndicador icon={TrendingUp} label="Rendimiento vs programado" valor={`${rendimiento}%`} tone="info" />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Horario del turno</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Hora de inicio">
            <Input
              type="time"
              value={produccion.horaInicio}
              onChange={(e) => set({ horaInicio: e.target.value })}
              className="h-9"
            />
          </Campo>
          <Campo label="Hora de fin">
            <Input
              type="time"
              value={produccion.horaFin}
              onChange={(e) => set({ horaFin: e.target.value })}
              className="h-9"
            />
          </Campo>
        </div>
      </div>
    </div>
  )
}

function Valor({
  label,
  value,
  readonly = true,
}: {
  label: string
  value: string
  readonly?: boolean
}) {
  return (
    <div className={cn(readonly && "opacity-90")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function MiniIndicador({
  icon: Icon,
  label,
  valor,
  tone,
}: {
  icon: LucideIcon
  label: string
  valor: string
  tone: "success" | "info"
}) {
  const tonos = {
    success: "text-chart-3 bg-chart-3/10 border-chart-3/20",
    info: "text-chart-2 bg-chart-2/10 border-chart-2/20",
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tonos[tone]}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums text-primary">{valor}</p>
      </div>
    </div>
  )
}