import { useCallback, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Layers3,
  Loader2,
  PauseCircle,
  Play,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { api, getErrorMessage } from "@/lib/api"
import { formatDate, formatDateTime, formatDuration, formatNumber } from "@/lib/formatters"
import { puede } from "@/lib/permisos"
import { cn } from "@/lib/utils"

/** Orden devuelta por GET /produccion/trazabilidad (backend) */
interface OrdenTrazabilidad {
  id: string
  numero_op: string
  cliente: string
  producto: string
  descripcion: string | null
  unidad: string
  cantidad_planificada: number | null
  cantidad_producida: number
  prioridad: number
  estado: string
  fecha_emision: string | null
  fecha_programada: string | null
  fecha_fin_estimada: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  planta_nombre?: string
  area_nombre?: string
  maquina_nombre?: string
  turno_nombre?: string
  operario_nombre?: string
  avance: number | null
}

interface RegistroTrazabilidad {
  id: string
  op_id: string
  fecha: string
  turno_id: string
  operario_id: string
  hora_inicio: string | null
  hora_fin: string | null
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  unidad: string
  tiempo_operativo_min: number | null
  observaciones: string | null
  maquina_nombre?: string
  turno_nombre?: string
  operario_nombre?: string
}

interface ParadaTrazabilidad {
  id: string
  op_id: string
  registro_id: string | null
  maquina_id: string
  turno_id: string
  motivo: string
  tipo: string
  inicio: string
  fin: string | null
  duracion_min: number | null
  observacion: string | null
}

interface IncidenciaTrazabilidad {
  id: string
  op_id: string
  registro_id: string | null
  maquina_id: string
  tipo: string
  codigo: string | null
  descripcion: string | null
  lote: string | null
  cantidad: number | null
  estado: string
  fecha: string | null
  turno_id: string | null
  maquina_nombre?: string
  turno_nombre?: string
}

interface ResultadoTrazabilidad {
  orden: OrdenTrazabilidad
  registros: RegistroTrazabilidad[]
  paradas: ParadaTrazabilidad[]
  incidencias: IncidenciaTrazabilidad[]
  lotes: string[]
}

interface RespuestaTrazabilidad {
  total: number
  resultados: ResultadoTrazabilidad[]
}

const ESTADO_META: Record<string, { label: string; tone: BadgeProps["variant"] }> = {
  borrador: { label: "Borrador", tone: "secondary" },
  asignada: { label: "Programada", tone: "secondary" },
  en_produccion: { label: "En proceso", tone: "success" },
  pausada: { label: "Pausada", tone: "warning" },
  finalizada: { label: "Finalizada", tone: "outline" },
  cancelada: { label: "Cancelada", tone: "destructive" },
}

const TIPO_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  defecto: { label: "Defecto", icon: AlertTriangle, tone: "bg-chart-5/10 text-chart-5" },
  inspeccion: { label: "Inspección", icon: FlaskConical, tone: "bg-chart-2/10 text-chart-2" },
  nc: { label: "No conformidad", icon: ShieldCheck, tone: "bg-chart-1/10 text-chart-1" },
}

const ESTADO_INCIDENCIA: Record<string, { label: string; tone: BadgeProps["variant"] }> = {
  abierta: { label: "Abierta", tone: "warning" },
  en_revision: { label: "En revisión", tone: "secondary" },
  cerrada: { label: "Cerrada", tone: "success" },
}

interface Evento {
  key: string
  fecha: string
  tipo: "registro" | "parada" | "incidencia"
  dato: RegistroTrazabilidad | ParadaTrazabilidad | IncidenciaTrazabilidad
}

function Kpi({
  icon: Icon,
  label,
  valor,
  tone,
}: {
  icon: LucideIcon
  label: string
  valor: string
  tone: string
}) {
  return (
    <div className="rounded-2xl border bg-card px-5 py-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tone}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-primary">{valor}</p>
        </div>
      </div>
    </div>
  )
}

function FilaDetalle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{children}</p>
    </div>
  )
}

export function TrazabilidadPage() {
  const { user } = useAuth()
  const [termino, setTermino] = useState("")
  const [buscado, setBuscado] = useState("")
  const [cargando, setCargando] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaTrazabilidad | null>(null)
  const [error, setError] = useState<string | null>(null)

  const puedeVer = useMemo(() => puede(user, "op:ver"), [user])

  const buscar = useCallback(
    async (valor: string) => {
      const term = valor.trim()
      if (!term || !puedeVer) return
      setCargando(true)
      setError(null)
      setRespuesta(null)
      setBuscado(term)
      try {
        const params = /^op-[\w-]+$/i.test(term) ? { numero_op: term } : { lote: term }
        const r = await api.get<RespuestaTrazabilidad>("/produccion/trazabilidad", { params })
        setRespuesta(r.data)
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setCargando(false)
      }
    },
    [puedeVer],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void buscar(termino)
  }

  const kpis = useMemo(() => {
    if (!respuesta) return { ordenes: 0, lotes: 0, registros: 0, paradas: 0 }
    return {
      ordenes: respuesta.total,
      lotes: respuesta.resultados.reduce((acc, r) => acc + r.lotes.length, 0),
      registros: respuesta.resultados.reduce((acc, r) => acc + r.registros.length, 0),
      paradas: respuesta.resultados.reduce((acc, r) => acc + r.paradas.length, 0),
    }
  }, [respuesta])

  const eventos = useMemo((): Evento[] => {
    const resultado = respuesta?.resultados[0]
    if (!resultado) return []
    const items: Evento[] = [
      ...resultado.registros.map((r) => ({
        key: `r-${r.id}`,
        fecha: `${r.fecha}T${r.hora_inicio ?? "00:00"}`,
        tipo: "registro" as const,
        dato: r,
      })),
      ...resultado.paradas.map((p) => ({
        key: `p-${p.id}`,
        fecha: p.inicio,
        tipo: "parada" as const,
        dato: p,
      })),
      ...resultado.incidencias.map((i) => ({
        key: `i-${i.id}`,
        fecha: `${i.fecha ?? "0000-01-01"}T00:00`,
        tipo: "incidencia" as const,
        dato: i,
      })),
    ]
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [respuesta])

  const resultado = respuesta?.resultados[0] ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-3/15 text-chart-3">
            <Search className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Trazabilidad de producción</h1>
            <p className="text-sm text-muted-foreground">
              Rastrea la línea de vida de una orden de producción por número de OP o lote
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Buscar por número de OP (OP-2025-0001) o lote…"
              className="h-10 pl-9"
              disabled={!puedeVer}
            />
          </div>
          <Button type="submit" size="lg" disabled={!termino.trim() || cargando || !puedeVer}>
            {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Rastrear
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          El lote sigue el formato <span className="font-mono">OP-AAAA-NNNN-FECHA-TURNO</span> o el código
          registrado en una incidencia de calidad.
        </p>
      </div>

      {kpis.ordenes > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            icon={Layers3}
            label="Órdenes rastreadas"
            valor={String(kpis.ordenes)}
            tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
          />
          <Kpi
            icon={Play}
            label="Lotes identificados"
            valor={String(kpis.lotes)}
            tone="text-chart-3 bg-chart-3/10 border-chart-3/20"
          />
          <Kpi
            icon={ClipboardList}
            label="Registros por turno"
            valor={String(kpis.registros)}
            tone="text-chart-2 bg-chart-2/10 border-chart-2/20"
          />
          <Kpi
            icon={PauseCircle}
            label="Paradas"
            valor={String(kpis.paradas)}
            tone="text-chart-5 bg-chart-5/10 border-chart-5/20"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {!puedeVer ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-semibold">No tienes permiso para consultar la trazabilidad</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Contacta a un administrador para solicitar acceso a este módulo.
            </p>
          </div>
        ) : cargando ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Rastreando…
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-destructive">
            <span>{error}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setError(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : !buscado ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Search className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-sm font-semibold">Busca una orden para ver su trazabilidad</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Ingresa un número de orden de producción o un lote para reconstruir su línea de vida: turnos,
              paradas e incidencias de calidad.
            </p>
          </div>
        ) : !respuesta || respuesta.total === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Search className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-sm font-semibold">Sin resultados para “{buscado}”</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Verifica el número de OP o lote, o intenta con un término diferente.
            </p>
          </div>
        ) : resultado ? (
          <div className="space-y-6 p-4 sm:p-6">
            <section className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-primary">
                      {resultado.orden.numero_op}
                    </span>
                    <Badge variant={ESTADO_META[resultado.orden.estado]?.tone ?? "secondary"}>
                      {ESTADO_META[resultado.orden.estado]?.label ?? resultado.orden.estado}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{resultado.orden.producto}</p>
                  <p className="text-xs text-muted-foreground">
                    {resultado.orden.cliente}
                    {resultado.orden.descripcion ? ` · ${resultado.orden.descripcion}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        (resultado.orden.avance ?? 0) >= 100
                          ? "bg-chart-3"
                          : (resultado.orden.avance ?? 0) > 0
                            ? "bg-chart-1"
                            : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${resultado.orden.avance ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {resultado.orden.avance ?? 0}%
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-x-6 gap-y-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <FilaDetalle label="Planta · Área · Máquina">
                  {resultado.orden.planta_nombre ?? "—"} · {resultado.orden.area_nombre ?? "—"} ·{" "}
                  {resultado.orden.maquina_nombre ?? "—"}
                </FilaDetalle>
                <FilaDetalle label="Turno · Operario">
                  {resultado.orden.turno_nombre ?? "—"} ·{" "}
                  {resultado.orden.operario_nombre ?? "Sin asignar"}
                </FilaDetalle>
                <FilaDetalle label="Prioridad">{resultado.orden.prioridad} de 10</FilaDetalle>
                <FilaDetalle label="Cantidad">
                  {resultado.orden.cantidad_planificada != null
                    ? `${formatNumber(resultado.orden.cantidad_planificada, 1)} ${resultado.orden.unidad}`
                    : "—"}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (producida {formatNumber(resultado.orden.cantidad_producida, 1)})
                  </span>
                </FilaDetalle>
                <FilaDetalle label="Emisión · Programada">
                  {resultado.orden.fecha_emision ?? "—"} · {resultado.orden.fecha_programada ?? "—"}
                </FilaDetalle>
                <FilaDetalle label="Inicio · Fin real">
                  {resultado.orden.fecha_inicio
                    ? new Date(resultado.orden.fecha_inicio).toLocaleString("es")
                    : "—"}{" "}
                  ·{" "}
                  {resultado.orden.fecha_fin
                    ? new Date(resultado.orden.fecha_fin).toLocaleString("es")
                    : "—"}
                </FilaDetalle>
              </div>

              {resultado.lotes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Lotes asociados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resultado.lotes.map((lote) => (
                      <span
                        key={lote}
                        className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
                      >
                        {lote}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Línea de vida
              </p>
              {eventos.length === 0 ? (
                <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Esta orden no tiene registros de turno, paradas ni incidencias todavía.
                </p>
              ) : (
                <ol className="relative ml-3 space-y-6 border-l border-border pl-6">
                  {eventos.map((e) => {
                    if (e.tipo === "registro") {
                      const r = e.dato as RegistroTrazabilidad
                      return (
                        <li key={e.key} className="relative">
                          <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-chart-3/30 bg-card text-chart-3">
                            <ClipboardList className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatDate(r.fecha)}
                            {r.hora_inicio ? ` · ${r.hora_inicio}–${r.hora_fin ?? "…"}` : ""}
                          </p>
                          <div className="mt-1 rounded-xl border bg-card p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="font-semibold">Registro de turno</p>
                              {r.turno_nombre && (
                                <Badge variant="secondary">{r.turno_nombre}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {r.maquina_nombre ?? "—"} · {r.operario_nombre ?? "Sin operario"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm">
                              <span className="tabular-nums">
                                Total{" "}
                                <b className="text-primary">
                                  {formatNumber(r.produccion_total, 1)} {r.unidad}
                                </b>
                              </span>
                              <span className="tabular-nums text-chart-3">
                                Buena {formatNumber(r.produccion_buena, 1)}
                              </span>
                              <span className="tabular-nums text-destructive">
                                Rechazada {formatNumber(r.produccion_rechazada, 1)}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                Operativo {formatDuration(r.tiempo_operativo_min ?? 0)}
                              </span>
                            </div>
                            {r.observaciones && (
                              <p className="mt-2 text-xs text-muted-foreground">{r.observaciones}</p>
                            )}
                          </div>
                        </li>
                      )
                    }
                    if (e.tipo === "parada") {
                      const p = e.dato as ParadaTrazabilidad
                      return (
                        <li key={e.key} className="relative">
                          <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-chart-5/30 bg-card text-chart-5">
                            <PauseCircle className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatDateTime(p.inicio)}
                            {p.fin ? ` → ${formatDateTime(p.fin)}` : ""}
                          </p>
                          <div className="mt-1 rounded-xl border bg-card p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="font-semibold">Parada · {p.motivo}</p>
                              <Badge variant="warning">{p.tipo}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Duración {formatDuration(p.duracion_min ?? 0)}
                              {p.observacion ? ` · ${p.observacion}` : ""}
                            </p>
                          </div>
                        </li>
                      )
                    }
                    const i = e.dato as IncidenciaTrazabilidad
                    const meta = TIPO_META[i.tipo] ?? {
                      label: i.tipo,
                      icon: AlertTriangle,
                      tone: "bg-muted text-muted-foreground",
                    }
                    const IncIcon = meta.icon
                    return (
                      <li key={e.key} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-card ${meta.tone}`}
                        >
                          <IncIcon className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDate(i.fecha ?? "")}
                        </p>
                        <div className="mt-1 rounded-xl border bg-card p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="font-semibold">{meta.label}</p>
                            {i.codigo && <span className="font-mono text-xs">{i.codigo}</span>}
                            <Badge variant={ESTADO_INCIDENCIA[i.estado]?.tone ?? "secondary"}>
                              {ESTADO_INCIDENCIA[i.estado]?.label ?? i.estado}
                            </Badge>
                          </div>
                          {i.descripcion && (
                            <p className="mt-1 text-xs text-muted-foreground">{i.descripcion}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {i.maquina_nombre ?? "—"}
                            {i.lote ? ` · lote ${i.lote}` : ""}
                            {i.cantidad != null ? ` · ${formatNumber(i.cantidad, 1)}` : ""}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
