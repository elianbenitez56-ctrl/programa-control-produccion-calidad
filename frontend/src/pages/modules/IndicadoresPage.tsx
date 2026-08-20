import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Filter,
  Gauge,
  Loader2,
  PauseCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  Timer,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  ProductionByMachineChart,
  ProductionByOperatorChart,
  ProductionVsPlanChart,
  TiempoOperativoChart,
  WeeklyTrendChart,
  type EstadoRow,
  type MaquinaRow,
  type OperarioRow,
  type SerieDia,
  type TipoRow,
} from "@/components/dashboard/Charts"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { api, getErrorMessage } from "@/lib/api"
import { formatDuration, formatNumber, formatPercent } from "@/lib/formatters"
import { puede } from "@/lib/permisos"

interface TotalesIndicadores {
  registros: number
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  calidad_pct: number | null
  paradas: number
  tiempo_operativo_min: number
  tiempo_parada_min: number
  disponibilidad_pct: number | null
  ordenes_en_produccion: number
  incidencias: number
  incidencias_nc: number
}

interface RespuestaIndicadores {
  desde: string
  hasta: string
  totales: TotalesIndicadores
  serie_diaria: SerieDia[]
  por_maquina: MaquinaRow[]
  por_operario: OperarioRow[]
  por_estado: EstadoRow[]
  incidencias_por_tipo: TipoRow[]
}

interface CatalogoProduccion {
  plantas: { id: string; codigo: string; nombre: string }[]
}

interface OrdenPlan {
  id: string
  fecha_programada: string | null
  cantidad_planificada: number | null
}

const PERIODOS = [7, 15, 30]

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  asignada: "Programada",
  en_produccion: "En proceso",
  pausada: "Pausada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
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

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between border-b border-border/60 pb-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Tabla({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {headers.map((h, i) => (
              <th key={h} className={`px-3 py-2.5 ${i === 0 ? "pl-4" : ""} ${i === headers.length - 1 ? "pr-4" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function IndicadoresPage() {
  const { user } = useAuth()

  const [periodo, setPeriodo] = useState(7)
  const [fPlanta, setFPlanta] = useState("todas")
  const [plantas, setPlantas] = useState<CatalogoProduccion["plantas"]>([])

  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [datos, setDatos] = useState<RespuestaIndicadores | null>(null)

  const puedeVer = useMemo(() => puede(user, "dashboard:ver"), [user])

  const cargar = useCallback(async () => {
    if (!puedeVer) return
    setCargando(true)
    setErrorCarga(null)
    try {
      const hoy = new Date()
      const desde = new Date(hoy)
      desde.setDate(hoy.getDate() - (periodo - 1))
      const [rIndicadores, rCatalogo, rOrdenes] = await Promise.all([
        api.get<RespuestaIndicadores>("/produccion/indicadores", {
          params: {
            fecha_desde: desde.toISOString().slice(0, 10),
            fecha_hasta: hoy.toISOString().slice(0, 10),
            planta_id: fPlanta === "todas" ? undefined : fPlanta,
          },
        }),
        api.get<CatalogoProduccion>("/produccion/catalogo"),
        api.get<{ ordenes: OrdenPlan[] }>("/produccion/ordenes"),
      ])
      setPlantas(rCatalogo.data.plantas)
      const planPorFecha: Record<string, number> = {}
      for (const o of rOrdenes.data.ordenes) {
        if (!o.fecha_programada || o.cantidad_planificada == null) continue
        planPorFecha[o.fecha_programada] =
          (planPorFecha[o.fecha_programada] ?? 0) + o.cantidad_planificada
      }
      setDatos({
        ...rIndicadores.data,
        serie_diaria: rIndicadores.data.serie_diaria.map((d) => ({
          ...d,
          plan: planPorFecha[d.fecha] ?? null,
        })),
      })
    } catch (e) {
      setDatos(null)
      setErrorCarga(getErrorMessage(e))
    } finally {
      setCargando(false)
    }
  }, [puedeVer, periodo, fPlanta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const resumen = useMemo(() => {
    if (!datos) return null
    const t = datos.totales
    return {
      produccion: formatNumber(t.produccion_total, 1),
      calidad: t.calidad_pct != null ? formatPercent(t.calidad_pct) : "—",
      disponibilidad: t.disponibilidad_pct != null ? formatPercent(t.disponibilidad_pct) : "—",
      paradasTiempo: formatDuration(t.tiempo_parada_min),
      paradas: t.paradas,
      incidencias: t.incidencias,
      nc: t.incidencias_nc,
      registros: t.registros,
    }
  }, [datos])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
            <BarChart3 className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Indicadores de producción</h1>
            <p className="text-sm text-muted-foreground">
              Agregados de producción, calidad y disponibilidad por periodo
            </p>
          </div>
        </div>
      </div>

      {!puedeVer ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <BarChart3 className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-sm font-semibold">No tienes permiso para consultar indicadores</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Contacta a un administrador para solicitar acceso a este módulo.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Periodo y alcance
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Periodo (días)
                </p>
                <Select
                  value={String(periodo)}
                  onValueChange={(v) => setPeriodo(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Últimos {n} días
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planta
                </p>
                <Select
                  value={fPlanta}
                  onValueChange={(v) => setFPlanta(v)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {plantas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ventana consultada
                </p>
                <p className="flex h-9 items-center rounded-lg border bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
                  {datos ? `${datos.desde} → ${datos.hasta}` : "—"}
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => void cargar()}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-6 py-16 text-sm text-muted-foreground shadow-card">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando indicadores…
            </div>
          ) : errorCarga || !datos ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <BarChart3 className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-semibold">No fue posible cargar los indicadores</p>
              <p className="max-w-md text-xs text-muted-foreground">{errorCarga}</p>
              <Button variant="outline" size="sm" onClick={() => void cargar()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Kpi
                  icon={Package}
                  label="Producción total"
                  valor={`${resumen!.produccion} t`}
                  tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
                />
                <Kpi
                  icon={ShieldCheck}
                  label="Calidad"
                  valor={resumen!.calidad}
                  tone="text-chart-3 bg-chart-3/10 border-chart-3/20"
                />
                <Kpi
                  icon={Gauge}
                  label="Disponibilidad"
                  valor={resumen!.disponibilidad}
                  tone="text-chart-2 bg-chart-2/10 border-chart-2/20"
                />
                <Kpi
                  icon={Timer}
                  label="Tiempo en paradas"
                  valor={resumen!.paradasTiempo}
                  tone="text-chart-5 bg-chart-5/10 border-chart-5/20"
                />
                <Kpi
                  icon={PauseCircle}
                  label="Paradas"
                  valor={String(resumen!.paradas)}
                  tone="text-chart-4 bg-chart-4/10 border-chart-4/20"
                />
                <Kpi
                  icon={AlertTriangle}
                  label="Incidencias de calidad"
                  valor={String(resumen!.incidencias)}
                  tone="text-chart-5 bg-chart-5/10 border-chart-5/20"
                />
                <Kpi
                  icon={AlertTriangle}
                  label="No conformidades"
                  valor={String(resumen!.nc)}
                  tone="text-destructive bg-destructive/10 border-destructive/20"
                />
                <Kpi
                  icon={ClipboardList}
                  label="Registros de turno"
                  valor={String(resumen!.registros)}
                  tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-card p-4 shadow-card lg:col-span-2">
                  <p className="mb-1 text-sm font-semibold">Producción vs plan</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Toneladas por día frente a la cantidad planificada de las órdenes
                  </p>
                  <ProductionVsPlanChart serie={datos.serie_diaria} />
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="mb-1 text-sm font-semibold">Tiempo operativo diario</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Horas de operación registradas por día
                  </p>
                  <TiempoOperativoChart serie={datos.serie_diaria} />
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="mb-1 text-sm font-semibold">Tendencias de producción y calidad</p>
                  <p className="mb-3 text-xs text-muted-foreground">Últimos días del periodo</p>
                  <WeeklyTrendChart serie={datos.serie_diaria} />
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="mb-1 text-sm font-semibold">Producción por máquina</p>
                  <p className="mb-3 text-xs text-muted-foreground">Toneladas por equipo</p>
                  <ProductionByMachineChart maquinas={datos.por_maquina} />
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="mb-1 text-sm font-semibold">Producción por operario</p>
                  <p className="mb-3 text-xs text-muted-foreground">Registros de turno por operador</p>
                  <ProductionByOperatorChart operarios={datos.por_operario} />
                </div>
              </div>

              <Seccion titulo="Detalle por máquina" descripcion="Desempeño completo de cada equipo en el periodo">
                {datos.por_maquina.length === 0 ? (
                  <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    Sin producción registrada en el periodo.
                  </p>
                ) : (
                  <Tabla headers={["Máquina", "Registros", "Producción (t)", "Buena", "Rechazada", "Calidad", "T. operativo", "T. parada", "Disponibilidad"]}>
                    {datos.por_maquina.map((m) => (
                      <tr key={m.maquina_id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2.5 pl-4">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                            {m.maquina_codigo ?? m.maquina_nombre}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{m.registros}</td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">
                          {formatNumber(m.produccion_total, 1)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-chart-3">
                          {formatNumber(m.produccion_buena, 1)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-destructive">
                          {formatNumber(m.produccion_rechazada, 1)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {m.calidad_pct != null ? formatPercent(m.calidad_pct) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">
                          {formatDuration(m.tiempo_operativo_min)}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">
                          {formatDuration(m.tiempo_parada_min)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">
                          {m.disponibilidad_pct != null ? formatPercent(m.disponibilidad_pct) : "—"}
                        </td>
                      </tr>
                    ))}
                  </Tabla>
                )}
              </Seccion>

              <Seccion titulo="Detalle por operario" descripcion="Producción acumulada de cada operador">
                {datos.por_operario.length === 0 ? (
                  <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    Sin registros de operadores en el periodo.
                  </p>
                ) : (
                  <Tabla headers={["Operario", "Registros", "Producción (t)", "Buena"]}>
                    {datos.por_operario.map((o) => (
                      <tr key={o.operario_id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2.5 pl-4 font-semibold">{o.operario_nombre}</td>
                        <td className="px-3 py-2.5 tabular-nums">{o.registros}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {formatNumber(o.produccion_total, 1)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-chart-3">
                          {formatNumber(o.produccion_buena, 1)}
                        </td>
                      </tr>
                    ))}
                  </Tabla>
                )}
              </Seccion>

              <Seccion titulo="Órdenes por estado" descripcion="Distribución del parque de órdenes">
                <Tabla headers={["Estado", "Órdenes"]}>
                  {datos.por_estado.map((e) => (
                    <tr key={e.estado} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2.5 pl-4">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-chart-3" strokeWidth={1.75} />
                          {ESTADO_LABEL[e.estado] ?? e.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">{e.total}</td>
                    </tr>
                  ))}
                </Tabla>
              </Seccion>
            </>
          )}
        </>
      )}
    </div>
  )
}
