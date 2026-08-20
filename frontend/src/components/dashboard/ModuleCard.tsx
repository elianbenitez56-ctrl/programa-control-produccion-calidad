import { ArrowUpRight } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import type { ModuleDefinition } from "@/config/modules"
import { accentClasses } from "@/config/modules"
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

export function ModuleCard({ module: m }: { module: ModuleDefinition }) {
  const navigate = useNavigate()
  const Icon = m.icon

  return (
    <button
      type="button"
      onClick={() => navigate(m.path)}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25",
          m.accent === "blue" && "bg-chart-1",
          m.accent === "purple" && "bg-chart-2",
          m.accent === "green" && "bg-chart-3",
          m.accent === "amber" && "bg-chart-4",
          m.accent === "red" && "bg-chart-5",
        )}
      />
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110",
            accentClasses(m.accent),
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <Badge variant={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
      </div>
      <div className="mt-4">
        <p className="flex items-center gap-1 text-base font-semibold">
          {m.name}
          <ArrowUpRight className="h-4 w-4 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="font-medium">{m.features.length} capacidades</span>
        <span>{m.version}</span>
      </div>
    </button>
  )
}
