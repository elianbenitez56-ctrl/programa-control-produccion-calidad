import { useState, type FormEvent } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Hexagon,
  Loader2,
  Lock,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { getErrorMessage } from "@/lib/api"
import { esAccesoGlobal } from "@/config/usuarios"
import { rutaInicioPorRol } from "@/lib/permisos"

export function LoginPage() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const logged = await login(usuario, password)
      const destino = esAccesoGlobal(logged) ? from ?? "/inicio" : rutaInicioPorRol(logged)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm md:h-[80vh] md:max-h-[640px] md:min-h-[600px] md:max-w-6xl md:flex-row">
        <div className="relative hidden w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#030b4f] via-[#091254] to-[#005db6] p-10 text-white md:flex md:w-1/2 lg:p-12">
          <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
              <Hexagon className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">INAPEL</p>
              <p className="text-xs text-white/60">Production Control</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <h1 className="text-headline-lg font-bold leading-tight tracking-tight text-white">
              Sistema de Control de Producción y Calidad
            </h1>
            <p className="mt-3 text-body-lg text-white/80">
              Gestión integral de operaciones de planta, trazabilidad de calidad y análisis de
              eficiencia en tiempo real.
            </p>
          </div>

          <div className="relative mt-auto flex items-center gap-2 pt-10 text-white/70">
            <ShieldCheck className="h-[18px] w-[18px]" />
            <span className="text-label-md font-semibold uppercase tracking-wider">
              Acceso Seguro
            </span>
          </div>
        </div>

        <div className="relative flex w-full flex-1 flex-col justify-center bg-card px-6 py-8 sm:px-10 md:w-1/2 md:px-12 lg:px-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#030b4f] to-[#005db6]">
                <Hexagon className="h-5 w-5 text-white" strokeWidth={2.2} />
              </div>
              <p className="text-base font-bold tracking-tight text-foreground">INAPEL</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={toggleTheme}
              title="Cambiar tema"
            >
              {theme === "dark" ? "Tema claro" : "Tema oscuro"}
            </Button>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mt-8 animate-fade-up">
              <h2 className="text-headline-md font-semibold tracking-tight text-foreground">
                Iniciar Sesión
              </h2>
              <p className="mt-1 text-body-md text-muted-foreground">
                Ingrese sus credenciales para acceder al panel de control
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-label-md font-semibold uppercase tracking-wider">
                  Usuario o ID de Operador
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usuario"
                    autoComplete="username"
                    placeholder="Ej. admin"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    required
                    className="h-11 border-input pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-label-md font-semibold uppercase tracking-wider">
                    Contraseña
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Credenciales otorgadas por el administrador
                  </span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 border-input pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive animate-fade-in"
                  role="alert"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-label-md font-semibold text-destructive">
                      Error de Autenticación
                    </p>
                    <p className="text-sm text-destructive/90">{error}</p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full text-label-md font-semibold uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando…
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 border-t border-border/60 pt-4 text-center">
              <p className="text-label-md font-medium text-muted-foreground">
                SIGPC v0.1.0 · Conexión Segura
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}