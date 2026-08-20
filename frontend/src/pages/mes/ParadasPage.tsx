import { Timer } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { MesModuleShell } from "@/components/mes/MesModuleShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { getMaquina, getPlanta, getSeccion } from "@/config/plantas"

const columns: DataTableColumn<Record<string, unknown>>[] = [
  { key: "motivo", header: "Motivo" },
  { key: "inicio", header: "Inicio" },
  { key: "fin", header: "Fin" },
  { key: "duracion", header: "Duración" },
  { key: "turno", header: "Turno" },
  { key: "observacion", header: "Observación", className: "hidden md:table-cell" },
]

const demoParadas: Record<string, unknown>[] = [
  { motivo: "Cambio de formato", inicio: "08:12", fin: "08:47", duracion: "35 min", turno: "A", observacion: "Cambio de guillotina" },
  { motivo: "Falta de material", inicio: "09:03", fin: "09:18", duracion: "15 min", turno: "A", observacion: "Espera de bobina madre" },
  { motivo: "Daño mecánico", inicio: "11:40", fin: "12:25", duracion: "45 min", turno: "A", observacion: "Falla en rodillo" },
  { motivo: "Ajuste", inicio: "07:10", fin: "07:28", duracion: "18 min", turno: "A", observacion: "Registros de tensión" },
]

export function ParadasPage() {
  const { plantaId, seccionId, maquinaId } = useParams()
  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)
  const maquina = getMaquina(plantaId, seccionId, maquinaId)

  if (!planta || !seccion || !maquina) {
    return <Navigate to="/inicio" replace />
  }

  return (
    <MesModuleShell
      icon={Timer}
      title="Paradas"
      description={`Tiempos improductivos de ${maquina.nombre} (${seccion.nombre}, ${planta.nombre}). Motivo y observación registrados por el operario; minutos y tiempo se calculan de forma automática.`}
    >
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Paradas del turno</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            title="Paradas — vista previa"
            columns={columns}
            data={demoParadas}
            searchPlaceholder="Buscar paradas…"
            badgeKeys={["motivo"]}
          />
        </CardContent>
      </Card>
    </MesModuleShell>
  )
}