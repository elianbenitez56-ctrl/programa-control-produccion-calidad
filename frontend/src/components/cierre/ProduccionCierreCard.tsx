import { useState } from "react"
import { Calculator, Package, PackageCheck, PackageX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ProduccionCierreCardProps {
  total: number
  buena: number
  rechazada: number
  unidad: string
  onChange: (valores: { produccionTotal: number; buena: number; rechazada: number }) => void
}

function clampNum(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function ProduccionCierreCard({
  total,
  buena,
  rechazada,
  unidad,
  onChange,
}: ProduccionCierreCardProps) {
  const [totalStr, setTotalStr] = useState(total > 0 ? String(total) : "")
  const [buenaStr, setBuenaStr] = useState(buena > 0 ? String(buena) : "")
  const [rechazadaStr, setRechazadaStr] = useState(rechazada > 0 ? String(rechazada) : "")

  const totalNum = Number.parseFloat(totalStr) || 0
  const buenaNum = Number.parseFloat(buenaStr) || 0
  const rechazadaNum = Number.parseFloat(rechazadaStr) || 0
  const coherente = Math.abs(totalNum - buenaNum - rechazadaNum) <= 0.01

  function emit(next: { total?: string; buena?: string; rechazada?: string }) {
    const t = next.total !== undefined ? next.total : totalStr
    const b = next.buena !== undefined ? next.buena : buenaStr
    const r = next.rechazada !== undefined ? next.rechazada : rechazadaStr
    setTotalStr(t)
    setBuenaStr(b)
    setRechazadaStr(r)
    onChange({
      produccionTotal: Number.parseFloat(t) || 0,
      buena: Number.parseFloat(b) || 0,
      rechazada: Number.parseFloat(r) || 0,
    })
  }

  function onTotal(v: string) {
    const t = Number.parseFloat(v) || 0
    const r = Number.parseFloat(rechazadaStr) || 0
    const b = clampNum(t - r)
    emit({ total: v, buena: b > 0 || v !== "" ? String(b) : "" })
  }

  function onBuena(v: string) {
    const b = Number.parseFloat(v) || 0
    const t = Number.parseFloat(totalStr) || 0
    const r = clampNum(t - b)
    emit({ buena: v, rechazada: r > 0 ? String(r) : "" })
  }

  function onRechazada(v: string) {
    const r = Number.parseFloat(v) || 0
    const t = Number.parseFloat(totalStr) || 0
    const b = clampNum(t - r)
    emit({ rechazada: v, buena: b > 0 ? String(b) : "" })
  }

  function recalcBuena() {
    const t = Number.parseFloat(totalStr) || 0
    const r = Number.parseFloat(rechazadaStr) || 0
    emit({ buena: String(clampNum(t - r)) })
  }

  const quick = [5, 10, 25]

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Producción del turno</CardTitle>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Unidad: {unidad}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cierre-total">Producción total del turno *</Label>
            <div className="relative">
              <Input
                id="cierre-total"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={totalStr}
                onChange={(e) => onTotal(e.target.value)}
                className="h-11 pr-12 font-mono text-base"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {unidad}
              </span>
            </div>
            <div className="flex gap-1">
              {quick.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 px-1 text-xs"
                  onClick={() => onTotal(String((totalNum + v).toFixed(1)))}
                >
                  +{v}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cierre-buena">Cantidad buena *</Label>
            <div className="relative">
              <Input
                id="cierre-buena"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={buenaStr}
                onChange={(e) => onBuena(e.target.value)}
                className="h-11 pr-12 font-mono text-base"
              />
              <PackageCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chart-3" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se calcula como total − rechazada
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cierre-rechazada">Cantidad rechazada *</Label>
            <div className="relative">
              <Input
                id="cierre-rechazada"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={rechazadaStr}
                onChange={(e) => onRechazada(e.target.value)}
                className="h-11 pr-12 font-mono text-base"
              />
              <PackageX className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chart-5" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se calcula como total − buena
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3",
            coherente
              ? "border-chart-3/30 bg-chart-3/10 text-chart-3"
              : "border-chart-4/30 bg-chart-4/10 text-chart-4",
          )}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4" />
            {coherente
              ? `Consistente: buena (${(buenaNum).toFixed(1)}) + rechazada (${rechazadaNum.toFixed(1)}) = total (${totalNum.toFixed(1)}) ${unidad}`
              : "Buena + rechazada no coincide con la producción total"}
          </p>
          {!coherente && (
            <Button type="button" variant="outline" size="sm" onClick={recalcBuena}>
              Recalcular buena
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}