import { CheckCircle2, Circle, Sparkles } from "lucide-react"

import type { DemoProductionOrder } from "@/data/demo"
import { demoProductionOrders } from "@/data/demo"
import { accentClasses } from "@/config/modules"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface OrdenStepProps {
  ordenId: string | null
  onChange: (ordenId: string) => void
}

export function OrdenStep({ ordenId, onChange }: OrdenStepProps) {
  const { user } = useAuth()
  const orden = demoProductionOrders.find((o) => o.id === ordenId) ?? null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {demoProductionOrders.map((o) => {
          const selected = o.id === ordenId
          const Icon = selected ? CheckCircle2 : Circle
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={cn(
                "group relative flex flex-col rounded-xl border p-4 text-left transition-all duration-200",
                selected
                  ? "border-chart-1 bg-chart-1/5 shadow-card"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border ",
                    selected ? accentClasses("blue") : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", selected && "text-chart-1")} />
                </span>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {o.id}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{o.producto}</p>
              <p className="text-xs text-muted-foreground">{o.cliente}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs">
                <span className="font-medium text-muted-foreground">{o.maquina}</span>
                <span className="font-semibold tabular-nums">
                  Meta {o.meta} {o.unidad}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {orden ? (
        <div className="animate-fade-up overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <Sparkles className="h-4 w-4 text-chart-4" />
            <p className="text-sm font-semibold">Información cargada automáticamente</p>
            <p className="ml-auto text-xs text-muted-foreground">
              No es necesario registrar estos datos
            </p>
          </div>
          <DatosOrden orden={orden} operario={`${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim()} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
          Selecciona una orden para cargar los datos del turno
        </p>
      )}
    </div>
  )
}

export function DatosOrden({ orden, operario }: { orden: DemoProductionOrder; operario: string }) {
  const fields: { label: string; value: string; mono?: boolean }[] = [
    { label: "Producto", value: orden.producto },
    { label: "Cliente", value: orden.cliente },
    { label: "Referencia", value: orden.referencia, mono: true },
    { label: "Proceso", value: orden.proceso },
    { label: "Material", value: orden.material },
    { label: "Máquina", value: orden.maquina, mono: true },
    { label: "Turno", value: orden.turno },
    { label: "Fecha", value: orden.fecha },
    { label: "Operario", value: operario },
    { label: "Meta de producción", value: `${orden.meta} ${orden.unidad}`, mono: true },
  ]
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <div key={f.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {f.label}
          </p>
          <p className={cn("mt-0.5 text-sm font-medium", f.mono && "font-mono")}>{f.value}</p>
        </div>
      ))}
    </div>
  )
}