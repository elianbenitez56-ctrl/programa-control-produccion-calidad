import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { chartColors } from "@/lib/charts"

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 16px 40px -16px hsl(var(--foreground) / 0.25)",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
  itemStyle: { padding: 0 },
}

function axisProps() {
  return {
    tick: { fill: chartColors.text(), fontSize: 11 },
    axisLine: { stroke: chartColors.border() },
    tickLine: false as const,
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function SinDatos({ texto = "Sin datos para el periodo" }: { texto?: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {texto}
    </div>
  )
}

function etiquetaDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "2-digit" }).format(d)
}

export interface SerieDia {
  fecha: string
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  calidad_pct: number | null
  tiempo_operativo_min: number
  plan?: number | null
}

export interface EstadoRow {
  estado: string
  total: number
}

export interface TipoRow {
  tipo: string
  total: number
}

export interface MaquinaRow {
  maquina_id: string
  maquina_nombre: string
  maquina_codigo: string | null
  registros: number
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  calidad_pct: number | null
  tiempo_operativo_min: number
  tiempo_parada_min: number
  disponibilidad_pct: number | null
}

export interface OperarioRow {
  operario_id: string
  operario_nombre: string
  registros: number
  produccion_total: number
  produccion_buena: number
}

export const ESTADO_ORDEN_LABEL: Record<string, string> = {
  borrador: "Borrador",
  asignada: "Programada",
  en_produccion: "En proceso",
  pausada: "Pausada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
}

export const TIPO_INCIDENCIA_LABEL: Record<string, string> = {
  defecto: "Defecto",
  inspeccion: "Inspección",
  nc: "No conformidad",
}

export function ProductionVsPlanChart({ serie }: { serie: SerieDia[] }) {
  if (serie.length === 0) return <SinDatos />
  const data = serie.map((d) => ({
    day: etiquetaDia(d.fecha),
    produccion: d.produccion_total,
    plan: d.plan ?? null,
  }))
  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid()} vertical={false} />
            <XAxis dataKey="day" {...axisProps()} />
            <YAxis {...axisProps()} width={36} unit=" t" />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => {
                if (value == null) return ["—", "Plan"]
                return [
                  `${Number(value).toFixed(1)} t`,
                  name === "produccion" ? "Producción" : "Plan",
                ]
              }}
            />
            <Bar dataKey="produccion" radius={[5, 5, 0, 0]} maxBarSize={26}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.plan != null && d.produccion >= d.plan
                      ? chartColors.green()
                      : chartColors.blue()
                  }
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="plan"
              stroke={chartColors.purple()}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-6">
        <LegendDot color={chartColors.green()} label="Sobre plan" />
        <LegendDot color={chartColors.blue()} label="Producción" />
        <LegendDot color={chartColors.purple()} label="Plan" />
      </div>
    </div>
  )
}

export function TiempoOperativoChart({ serie }: { serie: SerieDia[] }) {
  if (serie.length === 0) return <SinDatos />
  const data = serie.map((d) => ({
    day: etiquetaDia(d.fecha),
    horas: Number((d.tiempo_operativo_min / 60).toFixed(1)),
  }))
  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="operativo-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.blue()} stopOpacity={0.4} />
                <stop offset="100%" stopColor={chartColors.blue()} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid()} vertical={false} />
            <XAxis dataKey="day" {...axisProps()} />
            <YAxis {...axisProps()} width={36} unit=" h" />
            <Tooltip
              {...tooltipStyle}
              formatter={(value) => [`${Number(value).toFixed(1)} h`, "Tiempo operativo"]}
            />
            <Area
              type="monotone"
              dataKey="horas"
              stroke={chartColors.blue()}
              strokeWidth={2}
              fill="url(#operativo-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-6">
        <LegendDot color={chartColors.blue()} label="Horas operativas" />
      </div>
    </div>
  )
}

interface SliceDatum {
  name: string
  value: number
  color: string
}

function DonutChart({ data, totalSuffix = "" }: { data: SliceDatum[]; totalSuffix?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">{totalSuffix}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const donutColors = [
  chartColors.blue(),
  chartColors.purple(),
  chartColors.green(),
  chartColors.amber(),
  chartColors.red(),
  chartColors.muted(),
]

export function OrdersByStatusChart({ estados }: { estados: EstadoRow[] }) {
  if (estados.length === 0) return <SinDatos texto="Sin órdenes de producción" />
  const data = estados.map((e, i) => ({
    name: ESTADO_ORDEN_LABEL[e.estado] ?? e.estado,
    value: e.total,
    color: donutColors[i % donutColors.length],
  }))
  return (
    <div className="pt-2">
      <DonutChart data={data} totalSuffix="órdenes" />
    </div>
  )
}

export function NcByTypeChart({ tipos }: { tipos: TipoRow[] }) {
  if (tipos.length === 0) return <SinDatos texto="Sin incidencias en el periodo" />
  const data = tipos.map((t, i) => ({
    name: TIPO_INCIDENCIA_LABEL[t.tipo] ?? t.tipo,
    value: t.total,
    color: donutColors[i % donutColors.length],
  }))
  return (
    <div className="pt-2">
      <DonutChart data={data} totalSuffix="incidencias" />
    </div>
  )
}

export function ProductionByMachineChart({ maquinas }: { maquinas: MaquinaRow[] }) {
  if (maquinas.length === 0) return <SinDatos texto="Sin registros de producción" />
  const data = [...maquinas]
    .sort((a, b) => b.produccion_total - a.produccion_total)
    .map((m) => ({ maquina: m.maquina_codigo ?? m.maquina_nombre, toneladas: m.produccion_total }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid()} horizontal={false} />
          <XAxis type="number" {...axisProps()} unit=" t" />
          <YAxis type="category" dataKey="maquina" width={72} {...axisProps()} />
          <Tooltip
            {...tooltipStyle}
            formatter={(value) => [`${Number(value).toFixed(1)} t`, "Producción"]}
          />
          <Bar
            dataKey="toneladas"
            fill={chartColors.purple()}
            radius={[0, 5, 5, 0]}
            maxBarSize={18}
            label={{ position: "right", fill: chartColors.text(), fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProductionByOperatorChart({ operarios }: { operarios: OperarioRow[] }) {
  if (operarios.length === 0) return <SinDatos texto="Sin registros de operadores" />
  const data = [...operarios]
    .sort((a, b) => b.registros - a.registros)
    .slice(0, 8)
    .map((o) => ({
      operario: o.operario_nombre.split(" ").slice(0, 2).join(" "),
      turnos: o.registros,
    }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid()} horizontal={false} />
          <XAxis type="number" {...axisProps()} />
          <YAxis type="category" dataKey="operario" width={96} {...axisProps()} />
          <Tooltip
            {...tooltipStyle}
            formatter={(value) => [`${value} turnos`, "Turnos completados"]}
          />
          <Bar
            dataKey="turnos"
            fill={chartColors.green()}
            radius={[0, 5, 5, 0]}
            maxBarSize={16}
            label={{ position: "right", fill: chartColors.text(), fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeeklyTrendChart({ serie }: { serie: SerieDia[] }) {
  if (serie.length === 0) return <SinDatos />
  const data = serie.map((d) => ({
    fecha: etiquetaDia(d.fecha),
    produccion: d.produccion_total,
    calidad: d.calidad_pct ?? null,
  }))
  return (
    <div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="trend-prod" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.blue()} stopOpacity={0.35} />
                <stop offset="100%" stopColor={chartColors.blue()} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid()} vertical={false} />
            <XAxis dataKey="fecha" {...axisProps()} />
            <YAxis yAxisId="left" {...axisProps()} width={40} unit=" t" />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={40}
              unit="%"
              domain={[90, 100]}
              {...axisProps()}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => {
                if (value == null) return ["—", "Calidad"]
                return name === "produccion"
                  ? [`${Number(value).toFixed(1)} t`, "Producción"]
                  : [`${Number(value).toFixed(1)}%`, "Calidad"]
              }}
            />
            <Legend
              content={() => (
                <div className="mt-2 flex justify-center gap-6">
                  <LegendDot color={chartColors.blue()} label="Producción (t)" />
                  <LegendDot color={chartColors.green()} label="Calidad (%)" />
                </div>
              )}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="produccion"
              stroke={chartColors.blue()}
              strokeWidth={2.5}
              fill="url(#trend-prod)"
            />
            <Bar
              yAxisId="right"
              dataKey="calidad"
              fill={chartColors.green()}
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
