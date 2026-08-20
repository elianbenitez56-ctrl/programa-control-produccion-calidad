import { CheckCircle2 } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ordenesParaMaquina } from "@/data/registroDiarioDemo"
import type { RegistroAutocompletado } from "@/types/registroDiario"

interface InfoGeneralStepProps {
  auto: RegistroAutocompletado
  ordenes: ReturnType<typeof ordenesParaMaquina>
  onSelectOrden: (ordenId: string) => void
}

function Valor({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function InfoGeneralStep({ auto, ordenes, onSelectOrden }: InfoGeneralStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl border border-chart-3/30 bg-chart-3/10 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-3" />
        <p className="text-xs font-medium text-chart-3">
          Información cargada automáticamente por el sistema desde los módulos existentes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Valor label="Planta" value={auto.plantaNombre} />
        <Valor label="Sección / Proceso" value={auto.seccionNombre} />
        <Valor label="Máquina" value={auto.maquinaNombre} />
        <Valor label="Operario" value={auto.operario} />
        <Valor label="Supervisor" value={auto.supervisor} />
        <Valor label="Fecha" value={auto.fecha} />
        <Valor label="Turno" value={auto.turno} />
        <Valor label="Cliente" value={auto.cliente} />
        <Valor label="Producto" value={auto.producto} />
        <Valor label="Material principal" value={auto.material} />
        <Valor label="Hora de inicio" value={auto.horaInicio} />
        <Valor label="Hora final" value={auto.horaFin} />
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <Label className="text-sm font-semibold">Orden de producción</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Si la máquina tiene varias órdenes, seleccione la que corresponde al turno.
        </p>
        <Select value={auto.ordenId || undefined} onValueChange={onSelectOrden}>
          <SelectTrigger className="mt-3 w-full sm:max-w-md">
            <SelectValue placeholder="Seleccione la orden de producción" />
          </SelectTrigger>
          <SelectContent>
            {ordenes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.id} · {o.producto} · {o.estado}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}