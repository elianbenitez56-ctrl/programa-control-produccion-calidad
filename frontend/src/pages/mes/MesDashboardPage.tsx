import { ArrowRight, Cog, Factory, Layers3 } from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"

import { RecentOrdersTable } from "@/components/dashboard/RecentOrdersTable"
import {
  ProductionVsPlanChart,
  TiempoOperativoChart,
  type SerieDia,
} from "@/components/dashboard/Charts"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { KpiCard } from "@/components/dashboard/KpiCard"
import {
  getMaquina,
  getPlanta,
  getSeccion,
  mesRutaBase,
  rutaSeccion,
} from "@/config/plantas"
import { mesModules, mesModuleRuta } from "@/config/mes"
import { demoKpis } from "@/data/demo"
import { cn } from "@/lib/utils"

const kpiKeys = new Set(["oee", "produccion", "calidad", "disponibilidad"])

const demoSerie: SerieDia[] = [
  { fecha: "2025-07-14", produccion_total: 42.1, produccion_buena: 40.8, produccion_rechazada: 1.3, calidad_pct: 96.8, tiempo_operativo_min: 420, plan: 40 },
  { fecha: "2025-07-15", produccion_total: 44.6, produccion_buena: 43.3, produccion_rechazada: 1.3, calidad_pct: 97.0, tiempo_operativo_min: 450, plan: 43 },
  { fecha: "2025-07-16", produccion_total: 39.8, produccion_buena: 38.6, produccion_rechazada: 1.2, calidad_pct: 96.9, tiempo_operativo_min: 405, plan: 42 },
  { fecha: "2025-07-17", produccion_total: 46.2, produccion_buena: 44.9, produccion_rechazada: 1.3, calidad_pct: 97.2, tiempo_operativo_min: 465, plan: 44 },
  { fecha: "2025-07-18", produccion_total: 48.9, produccion_buena: 47.6, produccion_rechazada: 1.3, calidad_pct: 97.4, tiempo_operativo_min: 480, plan: 45 },
  { fecha: "2025-07-19", produccion_total: 35.4, produccion_buena: 34.4, produccion_rechazada: 1.0, calidad_pct: 97.1, tiempo_operativo_min: 360, plan: 38 },
  { fecha: "2025-07-20", produccion_total: 30.1, produccion_buena: 29.2, produccion_rechazada: 0.9, calidad_pct: 97.0, tiempo_operativo_min: 300, plan: 32 },
]

/** Dashboard del sistema MES de una máquina */
export function MesDashboardPage() {
  const { plantaId, seccionId, maquinaId } = useParams()
  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)
  const maquina = getMaquina(plantaId, seccionId, maquinaId)

  if (!planta || !seccion || !maquina) {
    return <Navigate to="/inicio" replace />
  }

  const base = mesRutaBase(planta.id, seccion.id, maquina.id)
  const kpis = demoKpis.filter((k) => kpiKeys.has(k.key))

  return (
    <div className="space-y-6">
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-chart-1/20 bg-chart-1/10 text-chart-1 shadow-card">
            <Cog className="h-8 w-8" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Sistema MES · {planta.nombre}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{maquina.nombre}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Factory className="h-3 w-3" />
                {planta.razonSocial}
              </span>
              <Link
                to={rutaSeccion(planta.id, seccion.id)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
              >
                <Layers3 className="h-3 w-3" />
                {seccion.nombre}
              </Link>
            </div>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-1.5 text-xs font-bold text-chart-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-3 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-3" />
          </span>
          En línea
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.key} className={cn("animate-fade-up", i > 1 && "delay-150")}>
            <KpiCard kpi={kpi} />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tiempo operativo diario"
          subtitle={`${seccion.nombre} · ${planta.nombre}`}
          className="animate-fade-up delay-150"
        >
          <TiempoOperativoChart serie={demoSerie} />
        </ChartCard>

        <ChartCard
          title="Producción vs Plan"
          subtitle="Última semana"
          className="animate-fade-up delay-150"
        >
          <ProductionVsPlanChart serie={demoSerie} />
        </ChartCard>
      </div>

      <ChartCard
        title="Órdenes recientes"
        subtitle="Seguimiento en tiempo real"
        className="animate-fade-up delay-150"
      >
        <RecentOrdersTable />
      </ChartCard>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Módulos del sistema MES</h2>
            <p className="text-sm text-muted-foreground">
              Todas las operaciones se registran con el contexto {planta.nombre} ·{" "}
              {seccion.nombre} · {maquina.nombre}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mesModules
            .filter((m) => m.segment !== "")
            .map((m, i) => {
              const Icon = m.icon
              return (
                <Link
                  key={m.key}
                  to={mesModuleRuta(base, m.segment)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover animate-fade-up"
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-chart-1/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                      i % 2 === 1 && "bg-chart-4/10",
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-chart-1/20 bg-chart-1/10 text-chart-1">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">{m.label}</p>
                </Link>
              )
            })}
        </div>
      </section>
    </div>
  )
}