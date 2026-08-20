import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Filter,
  History,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/formatters"
import { puede } from "@/lib/permisos"

/** Registro devuelto por GET /auditoria (backend) */
interface RegistroBitacora {
  id: string
  usuario_id: string | null
  username: string | null
  accion: string
  modulo: string
  entidad: string
  entidad_id: string | null
  valor_anterior: unknown
  valor_nuevo: unknown
  ip: string | null
  dispositivo: string | null
  fecha: string
}

interface RespuestaAuditoria {
  total: number
  limit: number
  offset: number
  registros: RegistroBitacora[]
}

const MODULO_META: Record<string, { label: string; tone: BadgeProps["variant"] }> = {
  produccion: { label: "Producción", tone: "secondary" },
  configuracion: { label: "Configuración", tone: "secondary" },
  identidad: { label: "Usuarios", tone: "secondary" },
  auth: { label: "Acceso", tone: "secondary" },
}

const ACCION_META: Record<string, { label: string; tone: BadgeProps["variant"] }> = {
  op_creada: { label: "OP creada", tone: "secondary" },
  op_editada: { label: "OP editada", tone: "secondary" },
  op_eliminada: { label: "OP eliminada", tone: "destructive" },
  op_estado_cambiado: { label: "Estado de OP", tone: "secondary" },
  registro_creado: { label: "Registro creado", tone: "secondary" },
  registro_editado: { label: "Registro editado", tone: "secondary" },
  registro_eliminado: { label: "Registro eliminado", tone: "destructive" },
  parada_creada: { label: "Parada creada", tone: "secondary" },
  parada_cerrada: { label: "Parada cerrada", tone: "secondary" },
  incidencia_creada: { label: "Incidencia creada", tone: "secondary" },
  incidencia_estado: { label: "Estado de incidencia", tone: "secondary" },
  planta_creada: { label: "Planta creada", tone: "secondary" },
  planta_editada: { label: "Planta editada", tone: "secondary" },
  planta_desactivada: { label: "Planta desactivada", tone: "warning" },
  area_creada: { label: "Área creada", tone: "secondary" },
  area_editada: { label: "Área editada", tone: "secondary" },
  area_desactivada: { label: "Área desactivada", tone: "warning" },
  maquina_creada: { label: "Máquina creada", tone: "secondary" },
  maquina_editada: { label: "Máquina editada", tone: "secondary" },
  maquina_desactivada: { label: "Máquina desactivada", tone: "warning" },
  turno_creado: { label: "Turno creado", tone: "secondary" },
  turno_editado: { label: "Turno editado", tone: "secondary" },
  turno_desactivado: { label: "Turno desactivado", tone: "warning" },
  usuario_creado: { label: "Usuario creado", tone: "secondary" },
  usuario_editado: { label: "Usuario editado", tone: "secondary" },
  usuario_estado: { label: "Estado de usuario", tone: "warning" },
  usuario_eliminado: { label: "Usuario eliminado", tone: "destructive" },
  login_fallido: { label: "Login fallido", tone: "destructive" },
  login_password: { label: "Contraseña renovada", tone: "secondary" },
  logout: { label: "Cierre de sesión", tone: "outline" },
}

const ACCIONES = Object.keys(ACCION_META).sort()
const MODULOS = ["produccion", "configuracion", "identidad", "auth"]
const ETIQUETAS_POR_FILA = [10, 25, 50, 100]

const ETIQUETA_ENTIDAD: Record<string, string> = {
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

function Kpi({
  icon: Icon,
  label,
  valor,
  tone,
}: {
  icon: LucideIcon
  label: string
  valor: string
  tone: string
}) {
  return (
    <div className="rounded-2xl border bg-card px-5 py-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tone}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-primary">{valor}</p>
        </div>
      </div>
    </div>
  )
}

function DifJson({ valor, titulo }: { valor: unknown; titulo: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {valor == null ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Sin valor previo
        </p>
      ) : (
        <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          {JSON.stringify(valor, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function AuditoriaPage() {
  const { user } = useAuth()

  const [fModulo, setFModulo] = useState("todos")
  const [fAccion, setFAccion] = useState("todos")
  const [fTexto, setFTexto] = useState("")
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")
  const [aplicados, setAplicados] = useState({ texto: "", desde: "", hasta: "" })

  const [pagina, setPagina] = useState(0)
  const [filasPorPagina, setFilasPorPagina] = useState(25)

  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaAuditoria>({
    total: 0,
    limit: 25,
    offset: 0,
    registros: [],
  })
  const [detalle, setDetalle] = useState<RegistroBitacora | null>(null)

  const puedeVer = useMemo(() => puede(user, "auditoria:consultar"), [user])

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const r = await api.get<RespuestaAuditoria>("/auditoria", {
        params: {
          modulo: fModulo === "todos" ? undefined : fModulo,
          accion: fAccion === "todos" ? undefined : fAccion,
          fecha_desde: aplicados.desde || undefined,
          fecha_hasta: aplicados.hasta || undefined,
          limit: filasPorPagina,
          offset: pagina * filasPorPagina,
        },
      })
      setRespuesta(r.data)
    } catch {
      setRespuesta({ total: 0, limit: filasPorPagina, offset: 0, registros: [] })
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [fModulo, fAccion, aplicados, filasPorPagina, pagina])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const aplicarTexto = () => {
    setAplicados({ texto: fTexto, desde: fDesde, hasta: fHasta })
    setPagina(0)
  }

  const limpiarFiltros = () => {
    setFModulo("todos")
    setFAccion("todos")
    setFTexto("")
    setFDesde("")
    setFHasta("")
    setAplicados({ texto: "", desde: "", hasta: "" })
    setPagina(0)
  }

  const filtrados = useMemo(() => {
    const term = aplicados.texto.trim().toLowerCase()
    if (!term) return respuesta.registros
    return respuesta.registros.filter((r) =>
      [r.entidad_id, r.ip, r.dispositivo, r.username, ETIQUETA_ENTIDAD[r.entidad] ?? r.entidad]
        .some((v) => (v ?? "").toLowerCase().includes(term)),
    )
  }, [respuesta.registros, aplicados.texto])

  const kpis = useMemo(() => {
    const criticas = respuesta.registros.filter((r) =>
      ["op_eliminada", "registro_eliminado", "usuario_eliminado", "login_fallido"].includes(r.accion),
    ).length
    return { total: respuesta.total, criticas }
  }, [respuesta])

  const totalPaginas = Math.max(1, Math.ceil(respuesta.total / filasPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const inicioMostrado = respuesta.total === 0 ? 0 : paginaSegura * filasPorPagina + 1
  const finMostrado = Math.min(respuesta.total, paginaSegura * filasPorPagina + filasPorPagina)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
          <History className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Auditoría del sistema</h1>
          <p className="text-sm text-muted-foreground">
            Bitácora de eventos y cambios realizados en el sistema
          </p>
        </div>
      </div>

      {!puedeVer ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-sm font-semibold">No tienes permiso para consultar la auditoría</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Contacta a un administrador para solicitar acceso a este módulo.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Kpi
              icon={FileText}
              label="Eventos registrados"
              valor={new Intl.NumberFormat("es-MX").format(kpis.total)}
              tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
            />
            <Kpi
              icon={ClipboardList}
              label="Eventos en esta página"
              valor={String(respuesta.registros.length)}
              tone="text-chart-3 bg-chart-3/10 border-chart-3/20"
            />
            <Kpi
              icon={AlertTriangle}
              label="Eventos críticos"
              valor={String(kpis.criticas)}
              tone="text-chart-5 bg-chart-5/10 border-chart-5/20"
            />
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Módulo
                </p>
                <Select
                  value={fModulo}
                  onValueChange={(v) => {
                    setFModulo(v)
                    setPagina(0)
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {MODULOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODULO_META[m]?.label ?? m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Acción
                </p>
                <Select
                  value={fAccion}
                  onValueChange={(v) => {
                    setFAccion(v)
                    setPagina(0)
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="todos">Todas</SelectItem>
                    {ACCIONES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACCION_META[a]?.label ?? a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Buscar (ID, IP, usuario, entidad)
                </p>
                <Input
                  value={fTexto}
                  onChange={(e) => setFTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && aplicarTexto()}
                  placeholder="Texto libre…"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Desde
                </p>
                <Input type="datetime-local" value={fDesde} onChange={(e) => setFDesde(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hasta
                </p>
                <div className="flex gap-2">
                  <Input type="datetime-local" value={fHasta} onChange={(e) => setFHasta(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-9" onClick={limpiarFiltros}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Limpiar
              </Button>
              <Button size="sm" className="h-9" onClick={aplicarTexto}>
                <Search className="mr-2 h-3.5 w-3.5" />
                Aplicar
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            {cargando ? (
              <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando bitácora…
              </div>
            ) : errorCarga ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <History className="h-7 w-7" strokeWidth={1.5} />
                </span>
                <p className="text-sm font-semibold">No fue posible cargar la bitácora</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Intenta nuevamente en unos momentos.
                </p>
                <Button variant="outline" size="sm" onClick={() => void cargar()}>
                  Reintentar
                </Button>
              </div>
            ) : respuesta.total === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <History className="h-7 w-7" strokeWidth={1.5} />
                </span>
                <p className="mt-4 text-sm font-semibold">Sin eventos que mostrar</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Las acciones del sistema quedan registradas aquí automáticamente.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {respuesta.total} {respuesta.total === 1 ? "evento" : "eventos"}
                    {filtrados.length !== respuesta.registros.length &&
                      ` · ${filtrados.length} coinciden con el texto`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Fecha y hora</th>
                        <th className="px-3 py-3">Usuario</th>
                        <th className="px-3 py-3">Módulo</th>
                        <th className="px-3 py-3">Acción</th>
                        <th className="hidden px-3 py-3 lg:table-cell">Entidad</th>
                        <th className="hidden px-3 py-3 md:table-cell">ID</th>
                        <th className="hidden px-3 py-3 xl:table-cell">IP</th>
                        <th className="w-16 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((r) => {
                        const accionMeta = ACCION_META[r.accion] ?? {
                          label: r.accion,
                          tone: "secondary" as BadgeProps["variant"],
                        }
                        const moduloMeta = MODULO_META[r.modulo] ?? {
                          label: r.modulo,
                          tone: "outline" as BadgeProps["variant"],
                        }
                        return (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3 text-xs tabular-nums">{formatDateTime(r.fecha)}</td>
                            <td className="px-3 py-3">
                              <span className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                  <UserRound className="h-3.5 w-3.5" />
                                </span>
                                <span className="max-w-[160px] truncate font-semibold">
                                  {r.username ?? "Sistema"}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={moduloMeta.tone}>{moduloMeta.label}</Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={accionMeta.tone}>{accionMeta.label}</Badge>
                            </td>
                            <td className="hidden px-3 py-3 text-xs lg:table-cell">
                              {ETIQUETA_ENTIDAD[r.entidad] ?? r.entidad}
                            </td>
                            <td className="hidden px-3 py-3 font-mono text-xs md:table-cell">
                              {r.entidad_id ?? "—"}
                            </td>
                            <td className="hidden px-3 py-3 font-mono text-xs xl:table-cell">
                              {r.ip ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver detalle"
                                onClick={() => setDetalle(r)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Mostrando <span className="font-semibold text-foreground">{inicioMostrado}</span>–
                    <span className="font-semibold text-foreground">{finMostrado}</span> de{" "}
                    <span className="font-semibold text-foreground">{respuesta.total}</span> eventos
                  </p>
                  <div className="flex items-center gap-3">
                    <Select
                      value={String(filasPorPagina)}
                      onValueChange={(v) => {
                        setFilasPorPagina(parseInt(v, 10))
                        setPagina(0)
                      }}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ETIQUETAS_POR_FILA.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} por página
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={paginaSegura === 0}
                        onClick={() => setPagina((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
                        {paginaSegura + 1} / {totalPaginas}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={paginaSegura >= totalPaginas - 1}
                        onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <Dialog open={Boolean(detalle)} onOpenChange={(open) => !open && setDetalle(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Detalle del evento
                  {detalle && (
                    <Badge variant={ACCION_META[detalle.accion]?.tone ?? "secondary"}>
                      {ACCION_META[detalle.accion]?.label ?? detalle.accion}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>Información completa del registro de auditoría</DialogDescription>
              </DialogHeader>
              {detalle && (
                <div className="space-y-5">
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Información general
                    </p>
                    <div className="grid gap-x-6 gap-y-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha y hora</p>
                        <p className="font-semibold">{formatDateTime(detalle.fecha)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Usuario</p>
                        <p className="font-semibold">{detalle.username ?? "Sistema"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Módulo</p>
                        <p className="font-semibold">
                          {MODULO_META[detalle.modulo]?.label ?? detalle.modulo}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entidad</p>
                        <p className="font-semibold">{ETIQUETA_ENTIDAD[detalle.entidad] ?? detalle.entidad}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ID de entidad</p>
                        <p className="font-mono text-xs font-semibold">{detalle.entidad_id ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IP · Dispositivo</p>
                        <p className="font-semibold">
                          {detalle.ip ?? "—"} · {detalle.dispositivo ?? "—"}
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="grid gap-4 lg:grid-cols-2">
                    <DifJson valor={detalle.valor_anterior} titulo="Valor anterior" />
                    <DifJson valor={detalle.valor_nuevo} titulo="Valor nuevo" />
                  </section>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
