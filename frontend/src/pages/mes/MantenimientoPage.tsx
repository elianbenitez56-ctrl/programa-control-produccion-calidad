import { Wrench } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { MesModuleShell } from "@/components/mes/MesModuleShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { getMaquina, getPlanta, getSeccion } from "@/config/plantas"

const columns: DataTableColumn<Record<string, unknown>>[] = [
  { key: "actividad", header: "Actividad" },
  { key: "tipo", header: "Tipo" },
  { key: "programado", header: "Programado" },
  { key: "responsable", header: "Responsable" },
  { key: "estado", header: "Estado" },
]

const demoMantenimiento: Record<string, unknown>[] = [
  { actividad: "Lubricación mensual", tipo: "Preventivo", programado: "12 ago 2026", responsable: "Mto. Central", estado: "Programado" },
  { actividad: "Inspección de rodillos", tipo: "Preventivo", programado: "15 ago 2026", responsable: "Mto. Central", estado: "Programado" },
  { actividad: "Cambio de cuchillas", tipo: "Correctivo", programado: "06 ago 2026", responsable: "Operario turno A", estado: "Completado" },
  { actividad: "Calibración de tensión", tipo: "Preventivo", programado: "19 ago 2026", responsable: "Mto. Central", estado: "Programado" },
]

export function MantenimientoPage() {
  const { plantaId, seccionId, maquinaId } = useParams()
  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)
  const maquina = getMaquina(plantaId, seccionId, maquinaId)

  if (!planta || !seccion || !maquina) {
    return <Navigate to="/inicio" replace />
  }

  return (
    <MesModuleShell
      icon={Wrench}
      title="Mantenimiento"
      description={`Programa de mantenimiento preventivo y correctivo de ${maquina.nombre} (${seccion.nombre}, ${planta.nombre}).`}
    >
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Órdenes de mantenimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            title="Mantenimiento — vista previa"
            columns={columns}
            data={demoMantenimiento}
            searchPlaceholder="Buscar actividades…"
            badgeKeys={["estado"]}
          />
        </CardContent>
      </Card>
    </MesModuleShell>
  )
}