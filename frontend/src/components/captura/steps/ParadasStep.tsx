import { useState, type FormEvent } from "react"
import { Plus, Timer, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { downtimeReasons, reasonLabel } from "@/config/captura"
import type { ParadaRecord } from "@/lib/captura"
import { diffMinutes, formatMinutes, minutesOf, newId, nowTime } from "@/lib/captura"
import { cn } from "@/lib/utils"

interface ParadasStepProps {
  paradas: ParadaRecord[]
  onAdd: (parada: ParadaRecord) => void
  onRemove: (id: string) => void
}

export function ParadasStep({ paradas, onAdd, onRemove }: ParadasStepProps) {
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [inicio, setInicio] = useState(nowTime)
  const [fin, setFin] = useState(nowTime)
  const [observacion, setObservacion] = useState("")
  const [error, setError] = useState<string | null>(null)

  const tiempo = motivo && inicio && fin ? diffMinutes(inicio, fin) : 0

  function openDialog(reasonKey: string) {
    setMotivo(reasonKey)
    setInicio(nowTime())
    setFin(nowTime())
    setObservacion("")
    setError(null)
    setOpen(true)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!motivo) {
      setError("Selecciona un motivo")
      return
    }
    if (!inicio || !fin || minutesOf(fin) <= minutesOf(inicio)) {
      setError("La hora fin debe ser posterior a la hora inicio")
      return
    }
    onAdd({
      id: newId(),
      inicio,
      fin,
      motivo,
      observacion: observacion.trim(),
    })
    setOpen(false)
  }

  const totalDetenido = paradas.reduce((sum, p) => sum + diffMinutes(p.inicio, p.fin), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          Registra cada parada; el tiempo se calcula automáticamente
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
            totalDetenido > 0
              ? "bg-chart-4/15 text-chart-4"
              : "bg-muted text-muted-foreground",
          )}
        >
          Tiempo detenido total: {formatMinutes(totalDetenido)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {downtimeReasons.map((reason) => {
          const Icon = reason.icon
          return (
            <button
              key={reason.key}
              type="button"
              onClick={() => openDialog(reason.key)}
              className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-chart-4/50 hover:bg-chart-4/5 hover:shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground transition-colors group-hover:border-chart-4/40 group-hover:text-chart-4">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium leading-tight">{reason.label}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">
          Paradas registradas{" "}
          <span className="font-normal text-muted-foreground">({paradas.length})</span>
        </p>
        {paradas.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            <TriangleAlert className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Selecciona un motivo para registrar la primera parada
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Motivo</TableHead>
                  <TableHead>Hora inicio</TableHead>
                  <TableHead>Hora fin</TableHead>
                  <TableHead>Tiempo detenido</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paradas.map((p) => {
                  const ReasonIcon =
                    downtimeReasons.find((r) => r.key === p.motivo)?.icon ?? TriangleAlert
                  const enCurso = !p.fin
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <ReasonIcon className="h-4 w-4 text-chart-4" />
                          <span className="font-medium">{reasonLabel(p.motivo)}</span>
                          {enCurso && (
                            <span className="rounded-full bg-chart-4/15 px-2 py-0.5 text-[10px] font-semibold text-chart-4">
                              En curso
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.inicio}</TableCell>
                      <TableCell className="font-mono text-xs">{p.fin || "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "font-semibold tabular-nums",
                          diffMinutes(p.inicio, p.fin) > 0 && "text-chart-4",
                        )}
                      >
                        {formatMinutes(diffMinutes(p.inicio, p.fin))}
                      </TableCell>
                      <TableCell className="max-w-52 truncate text-muted-foreground">
                        {p.observacion || "—"}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => onRemove(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar parada</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {motivo ? reasonLabel(motivo) : "Registrar parada"}
            </DialogTitle>
            <DialogDescription>
              La hora fin y el tiempo detenido se calculan automáticamente
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <div className="grid grid-cols-2 gap-2">
                {downtimeReasons.map((reason) => {
                  const Icon = reason.icon
                  const selected = motivo === reason.key
                  return (
                    <button
                      key={reason.key}
                      type="button"
                      onClick={() => setMotivo(reason.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                        selected
                          ? "border-chart-4 bg-chart-4/10 text-chart-4"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {reason.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="parada-inicio">Hora inicio</Label>
                <Input
                  id="parada-inicio"
                  type="time"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parada-fin">Hora fin</Label>
                <Input
                  id="parada-fin"
                  type="time"
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                  className="font-mono"
                  required
                />
              </div>
            </div>
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
                tiempo > 0 ? "border-chart-4/30 bg-chart-4/10 text-chart-4" : "bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Timer className="h-4 w-4" />
                Tiempo detenido
              </span>
              <span className="font-bold tabular-nums">{formatMinutes(tiempo)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parada-obs">Observación</Label>
              <Input
                id="parada-obs"
                placeholder="Opcional"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Registrar parada
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}