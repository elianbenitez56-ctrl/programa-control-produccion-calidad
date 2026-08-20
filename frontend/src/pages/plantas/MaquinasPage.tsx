import { Boxes, Cog, PlusCircle } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { MachineCard } from "@/components/plantas/MachineCard"
import { NavigationBreadcrumb } from "@/components/plantas/NavigationBreadcrumb"
import { getPlanta, getSeccion } from "@/config/plantas"

/** Selección de máquina dentro de una sección */
export function MaquinasPage() {
  const { plantaId, seccionId } = useParams()
  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)

  if (!planta || !seccion) {
    return <Navigate to="/inicio" replace />
  }

  const SectionIcon = seccion.icon

  return (
    <div className="space-y-6">
      <NavigationBreadcrumb
        items={[
          { label: "Inicio", to: "/inicio" },
          { label: planta.nombre, to: `/planta/${planta.id}` },
          { label: seccion.nombre },
        ]}
      />

      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-chart-4/10 blur-3xl" />
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-chart-4/20 bg-chart-4/10 text-chart-4 shadow-card">
          <SectionIcon className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {planta.nombre} · {planta.razonSocial}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{seccion.nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seccion.maquinas.length} máquinas disponibles. Seleccione una para ingresar al
            sistema MES.
          </p>
        </div>
      </div>

      {seccion.maquinas.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {seccion.maquinas.map((maquina, i) => (
            <MachineCard
              key={maquina.id}
              planta={planta}
              seccion={seccion}
              maquina={maquina}
              index={i}
            />
          ))}
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-20 text-center animate-fade-up">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Cog className="h-8 w-8" strokeWidth={1.5} />
          </span>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            Sin máquinas configuradas aún
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            La sección {seccion.nombre} de {planta.nombre} está preparada en la estructura.
            Las máquinas se agregarán próximamente.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <PlusCircle className="h-3.5 w-3.5" />
            Estructura lista · equipos próximos
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Boxes className="h-3.5 w-3.5" />
        Al ingresar a una máquina se activa el sistema MES con el contexto Planta · Sección ·
        Máquina.
      </div>
    </div>
  )
}