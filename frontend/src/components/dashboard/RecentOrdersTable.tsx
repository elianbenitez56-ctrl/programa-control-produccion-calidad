import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface OrdenReciente {
  id: string
  numero_op: string
  cliente: string
  producto: string
  estado: string
  cantidad_planificada: number | null
  cantidad_producida: number
  unidad: string
  maquina_nombre?: string
  avance: number | null
}

const ESTADO_META: Record<string, { label: string; tone: "success" | "secondary" | "warning" | "destructive" }> = {
  borrador: { label: "Borrador", tone: "secondary" },
  asignada: { label: "Programada", tone: "secondary" },
  en_produccion: { label: "En proceso", tone: "success" },
  pausada: { label: "Pausada", tone: "warning" },
  finalizada: { label: "Finalizada", tone: "warning" },
  cancelada: { label: "Cancelada", tone: "destructive" },
}

export function RecentOrdersTable() {
  const [ordenes, setOrdenes] = useState<OrdenReciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    let activo = true
    api
      .get<{ ordenes: OrdenReciente[] }>("/produccion/ordenes")
      .then((r) => {
        if (activo) setOrdenes(r.data.ordenes.slice(0, 5))
      })
      .catch(() => {
        if (activo) setErrorCarga(true)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Orden</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">Máquina</TableHead>
              <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-40">Avance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Cargando órdenes…
                </TableCell>
              </TableRow>
            ) : errorCarga || ordenes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {errorCarga
                    ? "No fue posible cargar las órdenes."
                    : "Aún no hay órdenes de producción registradas."}
                </TableCell>
              </TableRow>
            ) : (
              ordenes.map((order) => {
                const meta = ESTADO_META[order.estado] ?? { label: order.estado, tone: "secondary" as const }
                const avance = order.avance ?? 0
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-semibold">{order.numero_op}</TableCell>
                    <TableCell>
                      <p>{order.producto}</p>
                      <p className="text-xs text-muted-foreground">{order.cliente}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                        {order.maquina_nombre ?? order.id.slice(0, 6)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatNumber(order.cantidad_planificada ?? order.cantidad_producida, 1)} {order.unidad}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              avance >= 100
                                ? "bg-chart-3"
                                : avance > 0
                                  ? "bg-chart-1"
                                  : "bg-muted-foreground/40",
                            )}
                            style={{ width: `${avance}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {avance}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          to="/produccion"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Ver todas las órdenes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}