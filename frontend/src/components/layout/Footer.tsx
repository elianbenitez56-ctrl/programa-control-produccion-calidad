import { Activity } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 border-t px-6 py-5 sm:flex-row sm:justify-between">
      <p className="text-xs text-muted-foreground">
        © 2026 SIGPC — Sistema Integral de Gestión de Producción y Calidad
      </p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-chart-3" />
          API operativa
        </span>
        <span>v0.1.0</span>
        <span className="hidden sm:inline">Entorno de desarrollo</span>
      </div>
    </footer>
  )
}
