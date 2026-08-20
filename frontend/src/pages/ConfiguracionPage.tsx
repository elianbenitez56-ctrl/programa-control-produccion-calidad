import { useState } from "react"
import {
  Bell,
  Check,
  ChevronRight,
  Globe,
  Moon,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/contexts/ThemeContext"
import { demoPlants } from "@/data/demo"
import { cn } from "@/lib/utils"

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-chart-1" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  )
}

export function ConfiguracionPage() {
  const { theme, setTheme } = useTheme()
  const [plant, setPlant] = useState(demoPlants[0]?.id ?? "PLT-01")
  const [language, setLanguage] = useState("es-MX")

  const [notifications, setNotifications] = useState({
    ordenes: true,
    calidad: true,
    noConformidades: true,
    reportes: false,
  })

  const [security, setSecurity] = useState({
    expiracionSesion: true,
    notificarSesiones: true,
    dobleFactor: false,
  })

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/dashboard" className="transition-colors hover:text-foreground">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Configuración</span>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza la apariencia y las preferencias de la plataforma
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex-row items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Apariencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:border-primary/40",
                  theme === "light" && "border-chart-1 bg-chart-1/5 ring-2 ring-chart-1/20",
                )}
              >
                <Sun className="h-5 w-5" />
                <span className="text-sm font-medium">Claro</span>
                {theme === "light" && <Check className="h-4 w-4 text-chart-1" />}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:border-primary/40",
                  theme === "dark" && "border-chart-1 bg-chart-1/5 ring-2 ring-chart-1/20",
                )}
              >
                <Moon className="h-5 w-5" />
                <span className="text-sm font-medium">Oscuro</span>
                {theme === "dark" && <Check className="h-4 w-4 text-chart-1" />}
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Compactar densidad</p>
                  <p className="text-xs text-muted-foreground">Reduce el espaciado de la interfaz</p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Próximamente
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex-row items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Preferencias generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Planta por defecto</Label>
              <Select value={plant} onValueChange={setPlant}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {demoPlants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es-MX">Español (México)</SelectItem>
                  <SelectItem value="es-ES">Español (España)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              Los cambios se aplican de forma inmediata y solo afectan la presentación.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex-row items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
            <ToggleSwitch
              checked={notifications.ordenes}
              onChange={(v) => setNotifications((s) => ({ ...s, ordenes: v }))}
              label="Cambios en órdenes"
              description="Nueva orden, finalización o pausa"
            />
            <ToggleSwitch
              checked={notifications.calidad}
              onChange={(v) => setNotifications((s) => ({ ...s, calidad: v }))}
              label="Resultados de inspección"
              description="Alertas de inspecciones de calidad"
            />
            <ToggleSwitch
              checked={notifications.noConformidades}
              onChange={(v) => setNotifications((s) => ({ ...s, noConformidades: v }))}
              label="No conformidades"
              description="Alerta inmediata de NC registradas"
            />
            <ToggleSwitch
              checked={notifications.reportes}
              onChange={(v) => setNotifications((s) => ({ ...s, reportes: v }))}
              label="Reportes generados"
              description="Aviso cuando un reporte está listo"
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex-row items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Seguridad de la sesión</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
            <ToggleSwitch
              checked={security.expiracionSesion}
              onChange={(v) => setSecurity((s) => ({ ...s, expiracionSesion: v }))}
              label="Expiración automática"
              description="Cerrar sesión tras periodo de inactividad"
            />
            <ToggleSwitch
              checked={security.notificarSesiones}
              onChange={(v) => setSecurity((s) => ({ ...s, notificarSesiones: v }))}
              label="Notificar nuevas sesiones"
              description="Aviso de inicio de sesión en otros dispositivos"
            />
            <ToggleSwitch
              checked={security.dobleFactor}
              onChange={(v) => setSecurity((s) => ({ ...s, dobleFactor: v }))}
              label="Doble factor de autenticación"
              description="Requerirá código adicional al ingresar"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}