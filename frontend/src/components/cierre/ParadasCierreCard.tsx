import { useState, type FormEvent } from "react"
import { Plus, Timer, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { diffMinutes, formatMinutes, minutesOf, newId, nowTime } from "@/lib/captura"
import type { ParadaCierre } from "@/lib/cierre"
import { cn } from "@/lib/utils"

interface ParadasCierreCardProps {
  paradas: ParadaCierre[]
  onChange: (paradas: ParadaCierre[]) => void
}

export function ParadasCierreCard({ paradas, onChange }: ParadasCierreCardProps) {
  const [motivo, setMotivo] = useState<string>("")
  const [inicio, setInicio] = useState(nowTime())
  const [fin, setFin] = useState(nowTime())
  const [observacion, setObservacion] = useState("")
  const [error, setError] = useState<string | null>(null)

  const vista = inicio && fin ? diffMinutes(inicio, fin) : 0
  const valido = motivo && inicio && fin && minutesOf(fin) > minutesOf(inicio)

  function registrar(e: FormEvent) {
    e.preventDefault()
    if (!motivo) {
      setError("Selecciona un motivo")
      return
    }
    if (minutesOf(fin) <= minutesOf(inicio)) {
      setError("La hora fin debe ser posterior a la hora inicio")
      return
    }
    onChange([
      ...paradas,
      {
        id: newId(),
        inicio,
        fin,
        motivo,
        observacion: observacion.trim(),
      },
    ])
    setMotivo("")
    setInicio(nowTime())
    setFin(nowTime())
    setObservacion("")
    setError(null)
  }

  const totalDetenido = paradas.reduce((sum, p) => sum + diffMinutes(p.inicio, p.fin), 0)

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Tiempos improductivos</CardTitle>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            totalDetenido > 0 ? "bg-chart-4/15 text-chart-4" : "bg-muted text-muted-foreground",
          )}
        >
          Total: {formatMinutes(totalDetenido)}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={registrar} className="grid gap-3 rounded-xl border bg-muted/20 p-4 lg:grid-cols-[minmax(160px,1.1fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_minmax(140px,1fr)_auto]">
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={(v) => { setMotivo(v); setError(null) }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {downtimeReasons.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-inicio">Hora inicio</Label>
            <Input
              id="p-inicio"
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-10 font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-fin">Hora fin</Label>
            <Input
              id="p-fin"
              type="time"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="h-10 font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-obs">Observación</Label>
            <Input
              id="p-obs"
              placeholder="Opcional"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={!valido} className="h-10 w-full">
              <Plus className="mr-2 h-4 w-4" />
              Agregar
            </Button>
          </div>
          <p
            className={cn(
              "col-span-full text-xs font-medium",
              vista > 0 ? "text-chart-4" : "text-muted-foreground",
            )}
          >
            Tiempo detenido del registro: {formatMinutes(vista)} — calculado automáticamente
          </p>
          {error && (
            <p className="col-span-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
              {error}
            </p>
          )}
        </form>

        {paradas.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            <TriangleAlert className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Sin tiempos improductivos registrados (puedes agregar varios)
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Motivo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paradas.map((p) => {
                  const ReasonIcon =
                    downtimeReasons.find((r) => r.key === p.motivo)?.icon ?? TriangleAlert
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <ReasonIcon className="h-4 w-4 text-chart-4" />
                          <span className="font-medium">{reasonLabel(p.motivo)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.inicio}</TableCell>
                      <TableCell className="font-mono text-xs">{p.fin}</TableCell>
                      <TableCell className="font-semibold tabular-nums text-chart-4">
                        {formatMinutes(diffMinutes(p.inicio, p.fin))}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {p.observacion || "—"}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => onChange(paradas.filter((x) => x.id !== p.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar registro</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}