import { Navigate, useParams } from "react-router-dom"

import { NavigationBreadcrumb } from "@/components/plantas/NavigationBreadcrumb"
import { SectionCard } from "@/components/plantas/SectionCard"
import { getPlanta } from "@/config/plantas"

/** Selección de sección / proceso de una planta */
export function SeccionesPage() {
  const { plantaId } = useParams()
  const planta = getPlanta(plantaId)

  if (!planta) {
    return <Navigate to="/inicio" replace />
  }

  const PlantaIcon = planta.icon

  return (
    <div className="space-y-6">
      <NavigationBreadcrumb
        items={[{ label: "Inicio", to: "/inicio" }, { label: planta.nombre }]}
      />

      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-chart-1/10 blur-3xl" />
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-chart-1/20 bg-chart-1/10 text-chart-1 shadow-card">
          <PlantaIcon className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Planta · {planta.razonSocial}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{planta.nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {planta.descripcion}. Seleccione un proceso para ver sus máquinas.
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {planta.secciones.map((seccion, i) => (
          <SectionCard key={seccion.id} planta={planta} seccion={seccion} index={i} />
        ))}
      </section>
    </div>
  )
}