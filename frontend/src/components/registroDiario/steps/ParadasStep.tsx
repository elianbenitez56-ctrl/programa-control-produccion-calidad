import { Clock3, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { downtimeReasons, reasonLabel } from "@/config/captura"
import { newId, diffMinutes, formatMinutes } from "@/lib/captura"
import type { ParadaRegistroItem } from "@/types/registroDiario"

interface ParadasStepProps {
  paradas: ParadaRegistroItem[]
  onChange: (paradas: ParadaRegistroItem[]) => void
}

export function ParadasStep({ paradas, onChange }: ParadasStepProps) {
  function actualizar(id: string, patch: Partial<ParadaRegistroItem>) {
    onChange(paradas.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function agregar() {
    onChange([
      ...paradas,
      { id: newId(), inicio: "", fin: "", motivo: downtimeReasons[0].key, observacion: "" },
    ])
  }

  function eliminar(id: string) {
    onChange(paradas.filter((p) => p.id !== id))
  }

  const tiempoTotal = paradas.reduce((acc, p) => {
    if (!p.inicio || !p.fin) return acc
    const m = diffMinutes(p.inicio, p.fin)
    return acc + (m > 0 ? m : 0)
  }, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Registre cada parada del turno con su horario y motivo (opcional).
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar parada
        </Button>
      </div>

      {paradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Clock3 className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm font-semibold">Sin paradas registradas</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Si el turno tuvo paradas, agréguelas con el botón superior.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-32 px-4 py-3">Hora inicio</th>
                <th className="w-32 px-3 py-3">Hora fin</th>
                <th className="w-24 px-3 py-3">Tiempo</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Observación</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {paradas.map((p) => {
                const tiempo =
                  p.inicio && p.fin ? Math.max(0, diffMinutes(p.inicio, p.fin)) : 0
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Input
                        type="time"
                        value={p.inicio}
                        onChange={(e) => actualizar(p.id, { inicio: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="time"
                        value={p.fin}
                        onChange={(e) => actualizar(p.id, { fin: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold tabular-nums text-primary">
                        {p.inicio && p.fin ? formatMinutes(tiempo) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Select value={p.motivo} onValueChange={(value) => actualizar(p.id, { motivo: value })}>
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {downtimeReasons.map((r) => (
                            <SelectItem key={r.key} value={r.key}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        value={p.observacion}
                        onChange={(e) => actualizar(p.id, { observacion: e.target.value })}
                        placeholder="Observación"
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => eliminar(p.id)}
                        title="Eliminar parada"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Tiempo improductivo total
                </td>
                <td className="px-3 py-2.5 text-xs font-bold tabular-nums text-primary" colSpan={3}>
                  {formatMinutes(tiempoTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {paradas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(paradas.map((p) => p.motivo))).map((motivo) => (
            <span
              key={motivo}
              className="rounded-full bg-chart-4/10 px-3 py-1 text-[11px] font-semibold text-chart-4"
            >
              {reasonLabel(motivo)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}