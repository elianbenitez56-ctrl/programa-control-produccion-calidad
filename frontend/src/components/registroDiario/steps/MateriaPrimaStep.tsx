import { Plus, Trash2, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { materiasSugeridasPara } from "@/data/registroDiarioDemo"
import { newId } from "@/lib/captura"
import type { MateriaPrimaItem } from "@/types/registroDiario"

interface MateriaPrimaStepProps {
  items: MateriaPrimaItem[]
  seccionId: string
  unidad: string
  onChange: (items: MateriaPrimaItem[]) => void
}

export function MateriaPrimaStep({ items, seccionId, unidad, onChange }: MateriaPrimaStepProps) {
  const sugeridas = materiasSugeridasPara(seccionId)
  const datalistId = "materias-primas-sugeridas"

  function actualizar(id: string, patch: Partial<MateriaPrimaItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function agregar() {
    onChange([...items, { id: newId(), material: sugeridas[0] ?? "", lote: "", cantidadUtilizada: 0, cantidadDesperdiciada: 0, cantidadDevuelta: 0 }])
  }

  function eliminar(id: string) {
    onChange(items.filter((it) => it.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Registre el consumo real de materias primas del turno. Cantidades en{" "}
          <span className="font-semibold text-foreground">{unidad}</span>.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar material
        </Button>
      </div>

      <datalist id={datalistId}>
        {sugeridas.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Package className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm font-semibold">Sin materias primas registradas</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Agregue los materiales consumidos durante el turno para poder finalizar el registro.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Material</th>
                <th className="px-3 py-3">Lote</th>
                <th className="w-28 px-3 py-3">Utilizada</th>
                <th className="w-28 px-3 py-3">Desperdiciada</th>
                <th className="w-28 px-3 py-3">Devuelta</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Input
                      list={datalistId}
                      value={it.material}
                      onChange={(e) => actualizar(it.id, { material: e.target.value })}
                      placeholder="Nombre del material"
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={it.lote}
                      onChange={(e) => actualizar(it.id, { lote: e.target.value })}
                      placeholder="Ej. B-411"
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={it.cantidadUtilizada}
                      onChange={(e) => actualizar(it.id, { cantidadUtilizada: Number(e.target.value) })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={it.cantidadDesperdiciada}
                      onChange={(e) => actualizar(it.id, { cantidadDesperdiciada: Number(e.target.value) })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={it.cantidadDevuelta}
                      onChange={(e) => actualizar(it.id, { cantidadDevuelta: Number(e.target.value) })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminar(it.id)}
                      title="Eliminar material"
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

      {items.length > 0 && (
        <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-3">
          <CampoResumen label="Total utilizada" valor={`${sum(items, "cantidadUtilizada").toFixed(1)} ${unidad}`} />
          <CampoResumen label="Total desperdiciada" valor={`${sum(items, "cantidadDesperdiciada").toFixed(1)} ${unidad}`} />
          <CampoResumen label="Total devuelta" valor={`${sum(items, "cantidadDevuelta").toFixed(1)} ${unidad}`} />
        </div>
      )}
    </div>
  )
}

function sum(items: MateriaPrimaItem[], key: "cantidadUtilizada" | "cantidadDesperdiciada" | "cantidadDevuelta"): number {
  return items.reduce((acc, it) => acc + (it[key] || 0), 0)
}

function CampoResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-primary">{valor}</p>
    </div>
  )
}