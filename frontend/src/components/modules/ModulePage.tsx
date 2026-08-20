import { ChevronRight, Clock3, Layers, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { modules, accentClasses } from "@/config/modules"
import type { ModuleDefinition } from "@/config/modules"
import { demoModuleTables } from "@/data/demo"
import { cn } from "@/lib/utils"

const statusLabel: Record<ModuleDefinition["status"], string> = {
  activo: "Activo",
  "en desarrollo": "En desarrollo",
  planificado: "Planificado",
}

const statusTone: Record<ModuleDefinition["status"], "success" | "secondary" | "warning"> = {
  activo: "success",
  "en desarrollo": "secondary",
  planificado: "warning",
}

interface ModulePageProps {
  moduleKey: string
  /** Columnas de la tabla demo del módulo */
  columns: DataTableColumn<Record<string, unknown>>[]
  stats?: { label: string; value: string; accent: ModuleDefinition["accent"] }[]
  title?: string
  headerAction?: React.ReactNode
  /** Filas a mostrar; por defecto usa las de `data/demo.ts` (vista previa) */
  data?: Record<string, unknown>[]
  /** Render de la columna "Acciones" al final de la tabla (opt-in por módulo) */
  rowActions?: (row: Record<string, unknown>) => React.ReactNode
}

export function ModulePage({
  moduleKey,
  columns,
  stats,
  title,
  headerAction,
  data,
  rowActions,
}: ModulePageProps) {
  const mod = modules.find((m) => m.key === moduleKey) ?? modules[0]
  const Icon = mod.icon
  const rows = data ?? (demoModuleTables[moduleKey] ?? [])
  const dataRows = rows as Record<string, unknown>[]

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/dashboard" className="transition-colors hover:text-foreground">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{mod.name}</span>
      </nav>

      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-card",
              accentClasses(mod.accent),
            )}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {title ?? mod.name}
              </h1>
              <Badge variant={statusTone[mod.status]}>{statusLabel[mod.status]}</Badge>
              <Badge variant="outline" className="font-mono">
                {mod.version}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {mod.description}
            </p>
          </div>
          {headerAction && (
            <div className="shrink-0 sm:ml-auto">{headerAction}</div>
          )}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="flex items-center gap-3 p-5">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border",
                    accentClasses(s.accent),
                  )}
                >
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card md:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Capacidades planificadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {mod.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Vista previa de datos · {mod.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            title={`${mod.name} — vista previa`}
            columns={columns}
            data={dataRows}
            searchPlaceholder={`Buscar en ${mod.name.toLowerCase()}…`}
            badgeKeys={["estado", "resultado", "rol"]}
            actions={rowActions}
          />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
        Este módulo se encuentra en desarrollo. La vista mostrada usa datos de
        demostración local y se conectará a las APIs del backend cuando el módulo esté
        disponible.
      </div>
    </div>
  )
}