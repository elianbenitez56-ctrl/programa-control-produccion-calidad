import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, CalendarClock, Loader2, Plus, Settings2 } from "lucide-react"
import { Link } from "react-router-dom"

import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline"
import { ChartCard } from "@/components/dashboard/ChartCard"
import {
  NcByTypeChart,
  OrdersByStatusChart,
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
import { KpiCard, type DashboardKpi } from "@/components/dashboard/KpiCard"
import { ModuleCard } from "@/components/dashboard/ModuleCard"
import { RecentOrdersTable } from "@/components/dashboard/RecentOrdersTable"
import { Button } from "@/components/ui/button"
import { modules } from "@/config/modules"
import { api, getErrorMessage } from "@/lib/api"
import { formatDuration, formatNumber, formatPercent, todayLong } from "@/lib/formatters"
import { cn } from "@/lib/utils"

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

interface OrdenPlan {
  id: string
  fecha_programada: string | null
  cantidad_planificada: number | null
}

function KpiEstado({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div>
      <p className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {nombre}
      </p>
      <p className="font-medium tabular-nums text-foreground">{valor}</p>
    </div>
  )
}

function MaquinaCard({ maquina }: { maquina: MaquinaRow }) {
  const disp = maquina.disponibilidad_pct
  const estado =
    disp == null
      ? { label: "Sin datos", cls: "bg-muted text-muted-foreground border-border" }
      : disp >= 90
        ? { label: "Óptimo", cls: "bg-success/10 text-success border-success/20" }
        : disp >= 80
          ? { label: "Regular", cls: "bg-warning/10 text-warning border-warning/30" }
          : { label: "Crítico", cls: "bg-destructive/10 text-destructive border-destructive/20" }
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              {maquina.maquina_codigo ?? maquina.maquina_nombre}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {maquina.maquina_nombre}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", estado.cls)}>
          {estado.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 p-4">
        <KpiEstado
          nombre="Disponibilidad"
          valor={maquina.disponibilidad_pct != null ? `${formatPercent(maquina.disponibilidad_pct)}` : "—"}
        />
        <KpiEstado
          nombre="Calidad"
          valor={maquina.calidad_pct != null ? formatPercent(maquina.calidad_pct) : "—"}
        />
        <KpiEstado
          nombre="Producción"
          valor={`${formatNumber(maquina.produccion_total, 1)} t`}
        />
        <KpiEstado nombre="Registros" valor={String(maquina.registros)} />
      </div>
      <div className="mt-auto h-1 w-full bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            disp == null
              ? "bg-muted-foreground/40"
              : disp >= 90
                ? "bg-success"
                : disp >= 80
                  ? "bg-warning"
                  : "bg-destructive",
          )}
          style={{ width: `${disp ?? 0}%` }}
        />
      </div>
    </div>
  )
}

function tendenciaSerie(serie: number[]): number | undefined {
  if (serie.length < 2) return undefined
  const primero = serie[0]
  const ultimo = serie[serie.length - 1]
  if (primero === 0) return undefined
  return Math.round(((ultimo - primero) / primero) * 1000) / 10
}

export function DashboardPage() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<RespuestaIndicadores | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [rIndicadores, rOrdenes] = await Promise.all([
        api.get<RespuestaIndicadores>("/produccion/indicadores"),
        api.get<{ ordenes: OrdenPlan[] }>("/produccion/ordenes"),
      ])
      const serie = rIndicadores.data.serie_diaria
      const planPorFecha: Record<string, number> = {}
      for (const o of rOrdenes.data.ordenes) {
        if (!o.fecha_programada || o.cantidad_planificada == null) continue
        planPorFecha[o.fecha_programada] =
          (planPorFecha[o.fecha_programada] ?? 0) + o.cantidad_planificada
      }
      setDatos({
        ...rIndicadores.data,
        serie_diaria: serie.map((d) => ({ ...d, plan: planPorFecha[d.fecha] ?? null })),
      })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const kpis = useMemo((): DashboardKpi[] => {
    if (!datos) return []
    const t = datos.totales
    const produccionSerie = datos.serie_diaria.map((d) => d.produccion_total)
    const calidadSerie = datos.serie_diaria
      .map((d) => d.calidad_pct)
      .filter((v): v is number => v != null)
    return [
      {
        key: "ordenes",
        label: "Órdenes activas",
        value: String(t.ordenes_en_produccion),
        accent: "blue",
        trendUpIsGood: true,
      },
      {
        key: "produccion",
        label: "Producción (7 días)",
        value: formatNumber(t.produccion_total, 1),
        unit: "t",
        accent: "green",
        trend: tendenciaSerie(produccionSerie),
        trendUpIsGood: true,
        trendLabel: "vs inicio del periodo",
        spark: produccionSerie,
      },
      {
        key: "inspecciones",
        label: "Incidencias (7 días)",
        value: String(t.incidencias),
        accent: "purple",
        trendUpIsGood: false,
      },
      {
        key: "nc",
        label: "No conformidades",
        value: String(t.incidencias_nc),
        accent: "red",
        trendUpIsGood: false,
      },
      {
        key: "disponibilidad",
        label: "Disponibilidad",
        value: t.disponibilidad_pct != null ? formatPercent(t.disponibilidad_pct) : "—",
        accent: "green",
        trendUpIsGood: true,
      },
      {
        key: "calidad",
        label: "Calidad",
        value: t.calidad_pct != null ? formatPercent(t.calidad_pct) : "—",
        accent: "purple",
        trend: tendenciaSerie(calidadSerie),
        trendUpIsGood: true,
        trendLabel: "vs inicio del periodo",
        spark: calidadSerie,
      },
      {
        key: "paradas",
        label: "Tiempo en paradas",
        value: formatDuration(t.tiempo_parada_min),
        accent: "amber",
        trendUpIsGood: false,
      },
      {
        key: "registros",
        label: "Registros del periodo",
        value: String(t.registros),
        accent: "blue",
        trendUpIsGood: true,
      },
    ]
  }, [datos])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-headline-md font-semibold text-foreground">Panel de Control</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Métricas de producción y calidad · {todayLong()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/cierre-turno">
              <CalendarClock className="mr-2 h-4 w-4" />
              Cierre de turno
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/reportes">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Nuevo reporte
            </Link>
          </Button>
          <Button asChild>
            <Link to="/produccion/captura">
              <Plus className="mr-2 h-4 w-4" />
              Nueva captura
            </Link>
          </Button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-6 py-20 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando indicadores…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-sm font-semibold">No fue posible cargar los indicadores</p>
          <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      ) : datos ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi, i) => (
              <div key={kpi.key} className={i > 3 ? "animate-fade-up delay-150" : "animate-fade-up"}>
                <KpiCard kpi={kpi} />
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Producción vs Plan"
              subtitle={`Toneladas producidas por día frente al plan · ${datos.desde} → ${datos.hasta}`}
              className="animate-fade-up delay-100 lg:col-span-2"
              action={<BadgeSelect label="Últimos 7 días" />}
            >
              <ProductionVsPlanChart serie={datos.serie_diaria} />
            </ChartCard>

            <ChartCard
              title="Tiempo operativo diario"
              subtitle="Horas de operación registradas por día"
              className="animate-fade-up delay-150"
            >
              <TiempoOperativoChart serie={datos.serie_diaria} />
            </ChartCard>

            <ChartCard
              title="Composición de órdenes"
              subtitle="Distribución por estado"
              className="animate-fade-up delay-150"
            >
              <OrdersByStatusChart estados={datos.por_estado} />
            </ChartCard>

            <ChartCard
              title="Incidencias por tipo"
              subtitle="Incidencia de calidad en el periodo"
              className="animate-fade-up delay-200"
            >
              <NcByTypeChart tipos={datos.incidencias_por_tipo} />
            </ChartCard>

            <ChartCard
              title="Producción por máquina"
              subtitle="Toneladas por equipo en el periodo"
              className="animate-fade-up delay-200"
            >
              <ProductionByMachineChart maquinas={datos.por_maquina} />
            </ChartCard>

            <ChartCard
              title="Producción por operario"
              subtitle="Registros de turno por operador"
              className="animate-fade-up delay-200"
            >
              <ProductionByOperatorChart operarios={datos.por_operario} />
            </ChartCard>

            <ChartCard
              title="Tendencias de producción y calidad"
              subtitle="Últimos 7 días"
              className="animate-fade-up delay-300 lg:col-span-2"
            >
              <WeeklyTrendChart serie={datos.serie_diaria} />
            </ChartCard>
          </div>

          <section>
            <div className="mb-4 flex items-end justify-between border-b border-border/60 pb-2">
              <div>
                <h2 className="text-headline-md font-semibold text-foreground">Estado de máquinas</h2>
                <p className="text-body-sm text-muted-foreground">
                  Indicadores por equipo con producción en el periodo
                </p>
              </div>
              <Link
                to="/planta/inapel"
                className="inline-flex items-center gap-1 text-label-md font-medium text-info hover:underline"
              >
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {datos.por_maquina.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Sin producción registrada en el periodo.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {datos.por_maquina.map((m) => (
                  <MaquinaCard key={m.maquina_id} maquina={m} />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Actividad reciente"
              subtitle="Últimos eventos de la bitácora"
              className="animate-fade-up delay-200 lg:col-span-1"
            >
              <ActivityTimeline />
            </ChartCard>

            <ChartCard
              title="Órdenes recientes"
              subtitle="Seguimiento en tiempo real"
              className="animate-fade-up delay-200 lg:col-span-2"
            >
              <RecentOrdersTable />
            </ChartCard>
          </div>
        </>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Módulos del sistema</h2>
            <p className="text-sm text-muted-foreground">
              Explora las áreas de producción y calidad de SIGPC
            </p>
          </div>
          <Link
            to="/produccion"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
          >
            Ver todos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <div key={m.key} className={cnStagger(i)}>
              <ModuleCard module={m} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function cnStagger(i: number): string {
  const delays = ["", "delay-75", "delay-100", "delay-150", "delay-200", "delay-300"]
  return `animate-fade-up ${delays[i % 6] ?? ""}`.trim()
}

function BadgeSelect({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  )
}
