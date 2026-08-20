import { useEffect, useState } from "react"
import { Building2, Clock3, Layers3, ShieldCheck } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pct } from "@/lib/registroDiario/compute"
import { consolidarPorOrden, tiempoParadasTexto, type ConsolidadoOrden } from "@/lib/registroDiario/consolidacion"
import { listarRegistros } from "@/services/registroDiarioService"

interface ConsolidadoOrdenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordenId: string
}

function MiniKpi({ label, valor, tone }: { label: string; valor: string; tone: "blue" | "green" | "amber" }) {
  const tones = {
    blue: "text-chart-1 bg-chart-1/10 border-chart-1/20",
    green: "text-chart-3 bg-chart-3/10 border-chart-3/20",
    amber: "text-chart-4 bg-chart-4/10 border-chart-4/20",
  }
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tones[tone].split(" ")[0]}`}>{valor}</p>
    </div>
  )
}

export function ConsolidadoOrdenDialog({ open, onOpenChange, ordenId }: ConsolidadoOrdenDialogProps) {
  const [data, setData] = useState<ConsolidadoOrden | null>(null)

  useEffect(() => {
    if (open && ordenId) {
      setData(consolidarPorOrden(listarRegistros(), ordenId))
    }
  }, [open, ordenId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Consolidado de la orden {ordenId}</DialogTitle>
          <DialogDescription>
            Todos los registros diarios de las áreas de INAPEL para esta orden de producción.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay registros consolidados para esta orden todavía.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniKpi label="Áreas con registro" valor={String(data.areas.length)} tone="blue" />
              <MiniKpi label="Producción buena" valor={data.totalBuena.toFixed(1)} tone="green" />
              <MiniKpi label="OEE promedio" valor={`${pct(data.oeePromedio)}%`} tone="blue" />
              <MiniKpi label="Tiempo de paradas" valor={tiempoParadasTexto(data.tiempoParadasMin)} tone="amber" />
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Área · Máquina</th>
                    <th className="px-3 py-2.5">Operario</th>
                    <th className="px-3 py-2.5">Turno</th>
                    <th className="px-3 py-2.5 text-right">Producida</th>
                    <th className="px-3 py-2.5 text-right">Buena</th>
                    <th className="px-3 py-2.5 text-right">Paradas</th>
                    <th className="px-3 py-2.5 text-right">OEE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.areas.map((a) => (
                    <tr key={a.folio} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold">{a.seccionNombre}</p>
                        <p className="text-xs text-muted-foreground">{a.maquinaNombre}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{a.operario}</td>
                      <td className="px-3 py-2.5 text-xs">{a.turno}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.produccionTotal.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-chart-3">{a.produccionBuena.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.paradas}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">{pct(a.oee)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-bold">
                    <td className="px-4 py-2.5" colSpan={3}>
                      Totales de la orden
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{data.totalProducida.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-chart-3">{data.totalBuena.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{data.totalParadas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-primary">{pct(data.oeePromedio)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers3 className="h-3.5 w-3.5 text-chart-2" /> Total producida
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-chart-3" /> Calidad promedio {pct(data.calidadPromedio)}%
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-chart-4" /> {data.totalReprocesada.toFixed(1)} reprocesada
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-chart-1" /> {data.areas.length} registros
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}