import { ArrowRight, Hexagon, MapPin, ShieldCheck, UserRound } from "lucide-react"
import { Link } from "react-router-dom"

import { PlantCard } from "@/components/plantas/PlantCard"
import { Button } from "@/components/ui/button"
import { plantas } from "@/config/plantas"
import { areaAsignadaResuelta } from "@/config/usuarios"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Vista principal: acceso directo del operario a su área de trabajo
 * (calculado de su usuario) y selección de planta para el MES.
 */
export function InicioPage() {
  const { user } = useAuth()
  const miArea = areaAsignadaResuelta(user)

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-chart-4/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#030b4f] to-[#005db6] shadow-card">
                <Hexagon className="h-6 w-6 text-white" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-lg font-bold tracking-tight">INAPEL</p>
                <p className="text-xs text-muted-foreground">
                  Control de Producción y Calidad
                </p>
              </div>
            </div>
            <h1 className="mt-6 text-headline-lg text-primary sm:text-headline-lg">
              Control de Producción y Calidad
            </h1>
            <p className="mt-2 text-body-lg text-muted-foreground">
              Cada operario registra la producción y calidad de su propio proceso.
            </p>
          </div>
        </div>
      </header>

      {miArea && (
        <section>
          <div className="mb-5">
            <h2 className="text-title-lg tracking-tight">Mi área de trabajo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acceso directo al registro correspondiente a su cargo
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-chart-1/10 to-chart-4/10 shadow-card">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <MapPin className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {miArea.cargo} · {miArea.plantaNombre}
                  </p>
                  <p className="text-lg font-bold tracking-tight">
                    {miArea.seccionNombre} · {miArea.maquinaNombre}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      Supervisor: {miArea.supervisor}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-chart-3" />
                      Registro de producción y calidad
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <Button asChild size="lg">
                  <Link to={miArea.ruta}>
                    Registrar mi turno
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-title-lg tracking-tight">Plantas del grupo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Elija la planta y navegue por sus procesos y máquinas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {plantas.map((planta, i) => (
            <PlantCard key={planta.id} planta={planta} index={i} />
          ))}
        </div>
      </section>
    </div>
  )
}