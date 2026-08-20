import { useState, type FormEvent } from "react"
import { Eraser, Plus, Trash2, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProduccionRecord } from "@/lib/captura"
import { newId, nowTime } from "@/lib/captura"
import { cn } from "@/lib/utils"

interface ProduccionStepProps {
  registros: ProduccionRecord[]
  unidad: string
  onAdd: (record: ProduccionRecord) => void
  onRemove: (id: string) => void
}

const QUICK_AMOUNTS = [0.5, 1, 2]

export function ProduccionStep({ registros, unidad, onAdd, onRemove }: ProduccionStepProps) {
  const [hora] = useState(nowTime)
  const [cantidad, setCantidad] = useState("")
  const [rechazada, setRechazada] = useState("")
  const [observacion, setObservacion] = useState("")

  const cantidadNum = Number.parseFloat(cantidad)
  const rechazadaNum = Number.parseFloat(rechazada) || 0
  const cantidadValida = !Number.isNaN(cantidadNum) && cantidadNum > 0
  const buenaAuto = cantidadValida ? Math.max(0, cantidadNum - rechazadaNum) : 0

  function registrar() {
    if (!cantidadValida) return
    onAdd({
      id: newId(),
      hora,
      cantidad: cantidadNum,
      rechazada: rechazadaNum,
      observacion: observacion.trim(),
    })
    setRechazada("")
    setObservacion("")
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    registrar()
  }

  function addQuick(v: number) {
    setCantidad((prev) => {
      const base = Number.parseFloat(prev) || 0
      return String(Math.round((base + v) * 100) / 100)
    })
  }

  const total = registros.reduce((sum, r) => sum + r.cantidad, 0)
  const totalRechazo = registros.reduce((sum, r) => sum + r.rechazada, 0)
  const totalBuena = Math.max(0, total - totalRechazo)

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Registra cada producción completada durante el turno
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Zap className="h-3.5 w-3.5" />
            Registro rápido
          </span>
        </div>

        <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="hora">Hora</Label>
            <Input id="hora" value={hora} readOnly className="font-mono" />
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cantidad">Cantidad producida *</Label>
              <span className="text-[11px] text-muted-foreground">{unidad}</span>
            </div>
            <Input
              id="cantidad"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              placeholder="0.0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
              className="font-mono text-base"
            />
            <div className="flex gap-1">
              {QUICK_AMOUNTS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addQuick(v)}
                  className="flex-1 px-1 text-xs"
                >
                  +{v}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rechazada">Rechazada</Label>
            <Input
              id="rechazada"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              placeholder="0.0"
              value={rechazada}
              onChange={(e) => setRechazada(e.target.value)}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Buena: <span className="font-semibold tabular-nums text-chart-3">{buenaAuto.toFixed(1)} {unidad}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs-prod">Observación</Label>
            <Input
              id="obs-prod"
              placeholder="Opcional"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={!cantidadValida} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Registrar Producción
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            Producción registrada{" "}
            <span className="font-normal text-muted-foreground">({registros.length} registros)</span>
          </p>
          {registros.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-chart-1">{total.toFixed(1)} {unidad} total</span>
              <span className="font-semibold text-chart-3">{totalBuena.toFixed(1)} buena</span>
              {totalRechazo > 0 && (
                <span className="font-semibold text-chart-5">{totalRechazo.toFixed(1)} rechazada</span>
              )}
            </div>
          )}
        </div>

        {registros.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            <Eraser className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Aún no hay registros de producción en este turno
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-24">Hora</TableHead>
                  <TableHead>Cantidad producida</TableHead>
                  <TableHead>Cantidad buena</TableHead>
                  <TableHead>Cantidad rechazada</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.hora}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {r.cantidad.toFixed(1)} <span className="text-xs text-muted-foreground">{unidad}</span>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-chart-3">
                      {Math.max(0, r.cantidad - r.rechazada).toFixed(1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        r.rechazada > 0 ? "font-semibold text-chart-5" : "text-muted-foreground",
                      )}
                    >
                      {r.rechazada.toFixed(1)}
                    </TableCell>
                    <TableCell className="max-w-52 truncate text-muted-foreground">
                      {r.observacion || "—"}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemove(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar registro</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}