import { Lock, Sparkles } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DemoTurnoCierreContext } from "@/data/demo"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface InfoContextCardProps {
  contexto: DemoTurnoCierreContext
}

export function InfoContextCard({ contexto }: InfoContextCardProps) {
  const { user } = useAuth()

  const fields: { label: string; value: string; mono?: boolean; wide?: boolean }[] = [
    { label: "Orden de producción", value: contexto.orden, mono: true },
    { label: "Campaña de producción", value: contexto.campana, mono: true },
    { label: "Producto", value: contexto.producto, wide: true },
    { label: "Referencia", value: contexto.referencia, mono: true },
    { label: "Cliente", value: contexto.cliente },
    { label: "Máquina", value: contexto.maquina, mono: true },
    { label: "Línea", value: contexto.linea, mono: true },
    { label: "Proceso", value: contexto.proceso },
    { label: "Operario", value: `${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim() },
    { label: "Turno", value: contexto.turno },
    { label: "Fecha", value: contexto.fecha },
    { label: "Hora inicio del turno", value: contexto.horaInicio, mono: true },
    { label: "Hora final del turno", value: contexto.horaFin, mono: true },
    { label: "Supervisor", value: contexto.supervisor },
  ]

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-chart-4" />
          <CardTitle className="text-sm font-semibold">Datos del turno</CardTitle>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3" />
          Cargados automáticamente · no editables
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {fields.map((f) => (
            <div key={f.label} className={cn(f.wide && "sm:col-span-2")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label}
              </p>
              <p className={cn("mt-0.5 truncate text-sm font-medium", f.mono && "font-mono")}>
                {f.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}