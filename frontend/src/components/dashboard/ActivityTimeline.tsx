import { useEffect, useState } from "react"
import {
  Activity,
  Factory,
  KeyRound,
  Settings2,
  UserRound,
} from "lucide-react"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface EventoAuditoria {
  id: string
  username: string | null
  accion: string
  modulo: string
  entidad: string
  entidad_id: string | null
  fecha: string
}

const ACCION_LABEL: Record<string, string> = {
  op_creada: "Orden de producción creada",
  op_editada: "Orden de producción editada",
  op_eliminada: "Orden de producción eliminada",
  op_estado_cambiado: "Estado de orden cambiado",
  registro_creado: "Registro de producción creado",
  registro_editado: "Registro de producción editado",
  registro_eliminado: "Registro eliminado",
  parada_creada: "Parada registrada",
  parada_cerrada: "Parada cerrada",
  incidencia_creada: "Incidencia de calidad creada",
  incidencia_estado: "Estado de incidencia cambiado",
  planta_creada: "Planta creada",
  planta_editada: "Planta editada",
  planta_desactivada: "Planta desactivada",
  area_creada: "Área creada",
  area_editada: "Área editada",
  area_desactivada: "Área desactivada",
  maquina_creada: "Máquina creada",
  maquina_editada: "Máquina editada",
  maquina_desactivada: "Máquina desactivada",
  turno_creado: "Turno creado",
  turno_editado: "Turno editado",
  turno_desactivado: "Turno desactivado",
  usuario_creado: "Usuario creado",
  usuario_editado: "Usuario editado",
  usuario_estado: "Estado de usuario cambiado",
  usuario_eliminado: "Usuario eliminado",
  login_fallido: "Intento de acceso fallido",
  login_password: "Contraseña renovada",
  logout: "Cierre de sesión",
}

const ENTIDAD_LABEL: Record<string, string> = {
  orden_produccion: "Orden de producción",
  registro_diario: "Registro diario",
  parada: "Parada",
  incidencia_calidad: "Incidencia de calidad",
  planta: "Planta",
  area: "Área",
  maquina: "Máquina",
  turno: "Turno",
  usuario: "Usuario",
}

const MODULO_META: Record<string, { label: string; className: string }> = {
  produccion: { label: "Producción", className: "text-chart-1 bg-chart-1/10 border-chart-1/20" },
  configuracion: { label: "Configuración", className: "text-chart-2 bg-chart-2/10 border-chart-2/20" },
  identidad: { label: "Usuarios", className: "text-chart-3 bg-chart-3/10 border-chart-3/20" },
  auth: { label: "Acceso", className: "text-chart-5 bg-chart-5/10 border-chart-5/20" },
}

const MODULO_ICON = {
  produccion: Factory,
  configuracion: Settings2,
  identidad: UserRound,
  auth: KeyRound,
}

export function ActivityTimeline() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    api
      .get<{ registros: EventoAuditoria[] }>("/auditoria", { params: { limit: 6 } })
      .then((r) => {
        if (activo) setEventos(r.data.registros)
      })
      .catch(() => {
        if (activo) setEventos([])
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  if (cargando) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando actividad…</p>
  }

  if (eventos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin actividad reciente. Las acciones del sistema aparecerán aquí.
      </p>
    )
  }

  return (
    <ol className="relative space-y-6 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
      {eventos.map((event) => {
        const meta = MODULO_META[event.modulo] ?? {
          label: event.modulo,
          className: "bg-muted text-muted-foreground border-border",
        }
        const Icon = MODULO_ICON[event.modulo as keyof typeof MODULO_ICON] ?? Activity
        return (
          <li key={event.id} className="relative flex gap-4">
            <span
              className={cn(
                "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card",
                meta.className,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold">{ACCION_LABEL[event.accion] ?? event.accion}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ENTIDAD_LABEL[event.entidad] ?? event.entidad}
                {event.entidad_id ? ` · ${event.entidad_id}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/70">
                {meta.label} · {event.username ?? "Sistema"} · {formatDateTime(event.fecha)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
