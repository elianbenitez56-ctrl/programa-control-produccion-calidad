import { AlertTriangle, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { tiposDefecto } from "@/config/registroDiario"
import { newId } from "@/lib/captura"
import type { DefectoItem } from "@/types/registroDiario"

interface DefectosStepProps {
  defectos: DefectoItem[]
  onChange: (defectos: DefectoItem[]) => void
}

export function DefectosStep({ defectos, onChange }: DefectosStepProps) {
  function actualizar(id: string, patch: Partial<DefectoItem>) {
    onChange(defectos.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function agregar() {
    onChange([
      ...defectos,
      { id: newId(), tipo: tiposDefecto[0], cantidad: 0, observacion: "" },
    ])
  }

  function eliminar(id: string) {
    onChange(defectos.filter((d) => d.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Registre los defectos encontrados durante el turno. Campo opcional.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar defecto
        </Button>
      </div>

      {defectos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <AlertTriangle className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm font-semibold">Sin defectos registrados</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Si hubo defectos de calidad durante el turno, agréguelos con el botón superior.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Tipo de defecto</th>
                <th className="w-32 px-3 py-3">Cantidad</th>
                <th className="px-3 py-3">Observación</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {defectos.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Select
                      value={d.tipo}
                      onValueChange={(value) => actualizar(d.id, { tipo: value })}
                    >
                      <SelectTrigger className="h-9 w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposDefecto.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      value={d.cantidad}
                      onChange={(e) => actualizar(d.id, { cantidad: Number(e.target.value) })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={d.observacion}
                      onChange={(e) => actualizar(d.id, { observacion: e.target.value })}
                      placeholder="Observación"
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminar(d.id)}
                      title="Eliminar defecto"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}