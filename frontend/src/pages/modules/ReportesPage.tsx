import { ModulePage } from "@/components/modules/ModulePage"
import type { DataTableColumn } from "@/components/ui/data-table"

const columns: DataTableColumn<Record<string, unknown>>[] = [
  { key: "nombre", header: "Reporte" },
  { key: "modulo", header: "Módulo" },
  { key: "formato", header: "Formato" },
  { key: "generado", header: "Generado", className: "hidden sm:table-cell" },
  { key: "usuario", header: "Usuario", className: "hidden md:table-cell" },
]

export function ReportesPage() {
  return (
    <ModulePage
      moduleKey="reportes"
      columns={columns}
      stats={[
        { label: "Reportes este mes", value: "42", accent: "blue" },
        { label: "Exportaciones Excel", value: "31", accent: "green" },
        { label: "Exportaciones PDF", value: "11", accent: "red" },
        { label: "Reportes programados", value: "3", accent: "purple" },
      ]}
    />
  )
}