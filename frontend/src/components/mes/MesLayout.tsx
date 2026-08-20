import { useEffect } from "react"
import { Navigate, Outlet, useParams } from "react-router-dom"

import { MesContextBar } from "@/components/mes/MesContextBar"
import { MesModuleNav } from "@/components/mes/MesModuleNav"
import { NavigationBreadcrumb } from "@/components/plantas/NavigationBreadcrumb"
import {
  getMaquina,
  getPlanta,
  getSeccion,
  mesRutaBase,
  rutaSeccion,
} from "@/config/plantas"
import { useMes } from "@/contexts/MesContext"

/**
 * Layout del sistema MES de una máquina.
 * Recibe el contexto Planta · Sección · Máquina por URL, lo sincroniza
 * con la sesión (filtros globales) y renderiza la barra de contexto,
 * la navegación de módulos y el contenido.
 */
export function MesLayout() {
  const { plantaId, seccionId, maquinaId } = useParams()
  const { setSeleccion } = useMes()

  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)
  const maquina = getMaquina(plantaId, seccionId, maquinaId)

  useEffect(() => {
    if (plantaId && seccionId && maquinaId) {
      setSeleccion({ plantaId, seccionId, maquinaId })
    }
  }, [plantaId, seccionId, maquinaId, setSeleccion])

  if (!planta || !seccion || !maquina) {
    return <Navigate to="/inicio" replace />
  }

  const base = mesRutaBase(planta.id, seccion.id, maquina.id)

  return (
    <div className="space-y-6">
      <NavigationBreadcrumb
        items={[
          { label: "Inicio", to: "/inicio" },
          { label: planta.nombre, to: `/planta/${planta.id}` },
          { label: seccion.nombre, to: rutaSeccion(planta.id, seccion.id) },
          { label: maquina.nombre },
        ]}
      />

      <MesContextBar planta={planta} seccion={seccion} maquina={maquina} />
      <MesModuleNav base={base} />

      <Outlet />
    </div>
  )
}