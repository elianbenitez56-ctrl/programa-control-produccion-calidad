import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FlaskConical,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { api, getErrorMessage } from "@/lib/api"
import { formatDate, formatNumber } from "@/lib/formatters"
import { puede } from "@/lib/permisos"
import { cn } from "@/lib/utils"

/** Incidencia devuelta por GET /produccion/calidad (backend) */
interface IncidenciaApi {
  id: string
  op_id: string | null
  registro_id: string | null
  maquina_id: string
  tipo: string
  codigo: string | null
  descripcion: string | null
  lote: string | null
  cantidad: number | null
  estado: string
  fecha: string | null
  turno_id: string | null
  fecha_creacion: string | null
  maquina_nombre?: string
  turno_nombre?: string
  numero_op?: string
  producto?: string
  cliente?: string
}

interface CatalogoMaquina {
  id: string
  codigo: string
  nombre: string
}

interface OrdenReferencia {
  id: string
  numero_op: string
  producto: string
  estado: string
}

const ESTADO_META: Record<string, { label: string; tone: BadgeProps["variant"]; transiciones: string[] }> = {
  abierta: { label: "Abierta", tone: "warning", transiciones: ["en_revision"] },
  en_revision: { label: "En revisión", tone: "secondary", transiciones: ["cerrada", "abierta"] },
  cerrada: { label: "Cerrada", tone: "success", transiciones: [] },
}

const TIPO_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  defecto: { label: "Defecto", icon: AlertTriangle, tone: "bg-chart-5/10 text-chart-5" },
  inspeccion: { label: "Inspección", icon: FlaskConical, tone: "bg-chart-2/10 text-chart-2" },
  nc: { label: "No conformidad", icon: ShieldCheck, tone: "bg-chart-1/10 text-chart-1" },
}

const FORM_VACIO = {
  tipo: "defecto",
  maquina_id: "",
  op_id: "",
  codigo: "",
  lote: "",
  cantidad: "",
  descripcion: "",
  fecha: new Date().toISOString().slice(0, 10),
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

function Campo({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}

export function CalidadPage() {
  const { user } = useAuth()

  const [incidencias, setIncidencias] = useState<IncidenciaApi[]>([])
  const [maquinas, setMaquinas] = useState<CatalogoMaquina[]>([])
  const [ordenes, setOrdenes] = useState<OrdenReferencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const [busqueda, setBusqueda] = useState("")
  const [fEstado, setFEstado] = useState("todos")
  const [fTipo, setFTipo] = useState("todos")
  const [fMaquina, setFMaquina] = useState("todas")
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")
  const [pagina, setPagina] = useState(0)
  const [filasPorPagina, setFilasPorPagina] = useState(10)

  const [verIncidencia, setVerIncidencia] = useState<IncidenciaApi | null>(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [erroresForm, setErroresForm] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const [aTransicionar, setATransicionar] = useState<IncidenciaApi | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const sePuede = useMemo(
    () => ({
      registrar: puede(user, "calidad:defecto") || puede(user, "calidad:inspeccionar"),
      gestionar: puede(user, "calidad:nc"),
    }),
    [user],
  )

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const [rIncid, rCatalogo, rOrdenes] = await Promise.all([
        api.get<{ incidencias: IncidenciaApi[] }>("/produccion/calidad"),
        api.get<{ maquinas: CatalogoMaquina[] }>("/produccion/catalogo"),
        api.get<{ ordenes: OrdenReferencia[] }>("/produccion/ordenes"),
      ])
      setIncidencias(rIncid.data.incidencias)
      setMaquinas(rCatalogo.data.maquinas ?? [])
      setOrdenes(rOrdenes.data.ordenes ?? [])
    } catch {
      setIncidencias([])
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarTodo()
  }, [cargarTodo])

  const filtrados = useMemo(() => {
    let filas = incidencias
    if (fEstado !== "todos") filas = filas.filter((i) => i.estado === fEstado)
    if (fTipo !== "todos") filas = filas.filter((i) => i.tipo === fTipo)
    if (fMaquina !== "todas") filas = filas.filter((i) => i.maquina_id === fMaquina)
    if (fDesde) filas = filas.filter((i) => !i.fecha || i.fecha >= fDesde)
    if (fHasta) filas = filas.filter((i) => !i.fecha || i.fecha <= fHasta)
    const term = busqueda.trim().toLowerCase()
    if (term) {
      filas = filas.filter((i) =>
        [i.numero_op, i.producto, i.maquina_nombre, i.codigo, i.lote, i.descripcion,
          ESTADO_META[i.estado]?.label, TIPO_META[i.tipo]?.label]
          .some((v) => (v ?? "").toLowerCase().includes(term)),
      )
    }
    return filas
  }, [incidencias, fEstado, fTipo, fMaquina, fDesde, fHasta, busqueda])

  const kpis = useMemo(() => {
    const abiertas = incidencias.filter((i) => i.estado === "abierta").length
    const enRevision = incidencias.filter((i) => i.estado === "en_revision").length
    const cerradas = incidencias.filter((i) => i.estado === "cerrada").length
    const ncs = incidencias.filter((i) => i.tipo === "nc").length
    return { total: incidencias.length, abiertas, enRevision, cerradas, ncs }
  }, [incidencias])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / filasPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const filasPagina = filtrados.slice(
    paginaSegura * filasPorPagina,
    paginaSegura * filasPorPagina + filasPorPagina,
  )
  const inicioMostrado = filtrados.length === 0 ? 0 : paginaSegura * filasPorPagina + 1
  const finMostrado = Math.min(filtrados.length, paginaSegura * filasPorPagina + filasPorPagina)

  const limpiarFiltros = () => {
    setBusqueda("")
    setFEstado("todos")
    setFTipo("todos")
    setFMaquina("todas")
    setFDesde("")
    setFHasta("")
    setPagina(0)
  }

  const abrirForm = () => {
    setErroresForm([])
    setForm(FORM_VACIO)
    setFormAbierto(true)
  }

  const actualizarForm = (patch: Partial<typeof FORM_VACIO>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErroresForm([])
  }

  const ordenesCandidatas = useMemo(
    () =>
      ordenes.filter((o) =>
        o.estado === "en_produccion" || o.estado === "asignada" || o.estado === "pausada",
      ),
    [ordenes],
  )

  const validarForm = (): string[] => {
    const errores: string[] = []
    if (!form.maquina_id) errores.push("Selecciona una máquina")
    if (!form.descripcion.trim()) errores.push("La descripción es obligatoria")
    if (form.cantidad !== "") {
      const cantidad = parseFloat(form.cantidad)
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        errores.push("La cantidad debe ser un número mayor o igual a cero")
      }
    }
    return errores
  }

  const guardarIncidencia = async () => {
    const errores = validarForm()
    if (errores.length > 0) {
      setErroresForm(errores)
      return
    }
    setGuardando(true)
    setErroresForm([])
    try {
      await api.post("/produccion/calidad", {
        maquina_id: form.maquina_id,
        tipo: form.tipo,
        op_id: form.op_id || null,
        codigo: form.codigo.trim() || null,
        lote: form.lote.trim() || null,
        cantidad: form.cantidad === "" ? null : parseFloat(form.cantidad),
        descripcion: form.descripcion.trim(),
        fecha: form.fecha || null,
      })
      setFormAbierto(false)
      setPagina(0)
      await cargarTodo()
    } catch (error) {
      setErroresForm([getErrorMessage(error)])
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarTransicion = async (incidencia: IncidenciaApi, estado: string) => {
    setActualizando(incidencia.id)
    setErrorAccion(null)
    try {
      await api.post(`/produccion/calidad/${incidencia.id}/estado`, { estado })
      await cargarTodo()
    } catch (error) {
      setErrorAccion(getErrorMessage(error))
    } finally {
      setActualizando(null)
      setATransicionar(null)
      setNuevoEstado("")
    }
  }

  const tieneFiltros =
    busqueda !== "" || fEstado !== "todos" || fTipo !== "todos" ||
    fMaquina !== "todas" || fDesde !== "" || fHasta !== ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Control de Calidad</h1>
          <p className="text-sm text-muted-foreground">
            Incidencias de calidad (defectos, inspecciones y no conformidades)
          </p>
        </div>
        {sePuede.registrar && (
          <Button onClick={abrirForm}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar incidencia
          </Button>
        )}
      </div>

      {errorAccion ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorAccion}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={ClipboardList} label="Incidencias" valor={String(kpis.total)} tone="border-chart-1/30 bg-chart-1/10 text-chart-1" />
        <Kpi icon={AlertTriangle} label="Abiertas" valor={String(kpis.abiertas)} tone="border-chart-5/30 bg-chart-5/10 text-chart-5" />
        <Kpi icon={Loader2} label="En revisión" valor={String(kpis.enRevision)} tone="border-chart-4/30 bg-chart-4/10 text-chart-4" />
        <Kpi icon={CheckCircle2} label="Cerradas" valor={String(kpis.cerradas)} tone="border-chart-3/30 bg-chart-3/10 text-chart-3" />
      </div>

      <div className="rounded-2xl border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setPagina(0)
              }}
              placeholder="Buscar por OP, producto, máquina, código, lote…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={fEstado} onValueChange={(v) => { setFEstado(v); setPagina(0) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {Object.entries(ESTADO_META).map(([k, meta]) => (
                  <SelectItem key={k} value={k}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={(v) => { setFTipo(v); setPagina(0) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {Object.entries(TIPO_META).map(([k, meta]) => (
                  <SelectItem key={k} value={k}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fMaquina} onValueChange={(v) => { setFMaquina(v); setPagina(0) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las máquinas</SelectItem>
                {maquinas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fDesde}
              onChange={(e) => { setFDesde(e.target.value); setPagina(0) }}
              className="w-40"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={fHasta}
              onChange={(e) => { setFHasta(e.target.value); setPagina(0) }}
              className="w-40"
              aria-label="Hasta"
            />
            {tieneFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="mr-1.5 h-4 w-4" />
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Máquina</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">OP / Producto</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lote</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Cargando incidencias…
                  </td>
                </tr>
              ) : errorCarga || filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {errorCarga
                      ? "No fue posible cargar las incidencias. Intenta nuevamente."
                      : "Aún no hay incidencias de calidad registradas."}
                  </td>
                </tr>
              ) : (
                filasPagina.map((i) => {
                  const meta = ESTADO_META[i.estado] ?? ESTADO_META.abierta
                  const tipo = TIPO_META[i.tipo] ?? TIPO_META.defecto
                  return (
                    <tr key={i.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {i.fecha ? formatDate(i.fecha) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold", tipo.tone)}>
                          <tipo.icon className="h-3.5 w-3.5" />
                          {tipo.label}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="truncate font-medium">{i.descripcion ?? "—"}</p>
                        {i.codigo ? (
                          <p className="text-xs font-mono text-muted-foreground">{i.codigo}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                          {i.maquina_nombre ?? i.maquina_id.slice(0, 6)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {i.numero_op ? (
                          <>
                            <p className="font-mono text-xs font-semibold">{i.numero_op}</p>
                            <p className="text-xs text-muted-foreground">{i.producto ?? ""}</p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin OP</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{i.lote ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={actualizando === i.id}>
                              {actualizando === i.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setVerIncidencia(i)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalle
                            </DropdownMenuItem>
                            {sePuede.gestionar && meta.transiciones.length > 0 && (
                              meta.transiciones.map((t) => (
                                <DropdownMenuItem
                                  key={t}
                                  onClick={() => {
                                    setATransicionar(i)
                                    setNuevoEstado(t)
                                  }}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {ESTADO_META[t]?.label ?? t}
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-semibold">{inicioMostrado}</span>–
            <span className="font-semibold">{finMostrado}</span> de{" "}
            <span className="font-semibold">{filtrados.length}</span> incidencias
          </p>
          <div className="flex items-center gap-2">
            <select
              value={filasPorPagina}
              onChange={(e) => {
                setFilasPorPagina(Number(e.target.value))
                setPagina(0)
              }}
              className="rounded-lg border bg-background px-2 py-1.5 text-xs"
              aria-label="Filas por página"
            >
              {[5, 10, 25].map((n) => (
                <option key={n} value={n}>{n} por página</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaSegura === 0}
              onClick={() => setPagina(paginaSegura - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {paginaSegura + 1} / {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaSegura >= totalPaginas - 1}
              onClick={() => setPagina(paginaSegura + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Detalle */}
      <Dialog open={Boolean(verIncidencia)} onOpenChange={(open) => !open && setVerIncidencia(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {verIncidencia && (
                <>
                  <span>{TIPO_META[verIncidencia.tipo]?.label ?? verIncidencia.tipo}</span>
                  <Badge variant={ESTADO_META[verIncidencia.estado]?.tone ?? "secondary"}>
                    {ESTADO_META[verIncidencia.estado]?.label ?? verIncidencia.estado}
                  </Badge>
                </>
              )}
            </DialogTitle>
            <DialogDescription>Detalle de la incidencia de calidad</DialogDescription>
          </DialogHeader>
          {verIncidencia ? (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Máquina</p>
                  <p className="font-semibold">{verIncidencia.maquina_nombre ?? verIncidencia.maquina_id}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha</p>
                  <p className="font-semibold">{verIncidencia.fecha ? formatDate(verIncidencia.fecha) : "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orden de producción</p>
                  <p className="font-semibold">{verIncidencia.numero_op ?? "Sin OP"}</p>
                  <p className="text-xs text-muted-foreground">{verIncidencia.producto ?? ""}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lote</p>
                  <p className="font-mono font-semibold">{verIncidencia.lote ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Código</p>
                  <p className="font-mono">{verIncidencia.codigo ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cantidad</p>
                  <p className="font-semibold">
                    {verIncidencia.cantidad != null ? formatNumber(verIncidencia.cantidad, 2) : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
                <p className="mt-1 text-sm leading-relaxed">{verIncidencia.descripcion ?? "—"}</p>
              </div>
              {verIncidencia.fecha_creacion ? (
                <p className="text-xs text-muted-foreground">
                  Registrada el {formatDate(verIncidencia.fecha_creacion)}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Registrar incidencia */}
      <Dialog open={formAbierto} onOpenChange={(open) => !open && setFormAbierto(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar incidencia de calidad</DialogTitle>
            <DialogDescription>
              Los campos marcados son obligatorios. La incidencia queda abierta hasta su revisión.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => actualizarForm({ tipo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_META).map(([k, meta]) => (
                    <SelectItem key={k} value={k}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Máquina" error={erroresForm.includes("Selecciona una máquina") ? "Obligatorio" : undefined}>
              <Select value={form.maquina_id} onValueChange={(v) => actualizarForm({ maquina_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una máquina" />
                </SelectTrigger>
                <SelectContent>
                  {maquinas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Orden de producción (opcional)">
              <Select value={form.op_id} onValueChange={(v) => actualizarForm({ op_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin orden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin orden</SelectItem>
                  {ordenesCandidatas.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero_op} — {o.producto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Fecha">
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => actualizarForm({ fecha: e.target.value })}
              />
            </Campo>
            <Campo label="Código (opcional)">
              <Input
                value={form.codigo}
                onChange={(e) => actualizarForm({ codigo: e.target.value })}
                placeholder="Ej. D-0012"
              />
            </Campo>
            <Campo label="Lote (opcional)">
              <Input
                value={form.lote}
                onChange={(e) => actualizarForm({ lote: e.target.value })}
                placeholder="Ej. L-2026-001"
              />
            </Campo>
            <Campo label="Cantidad afectada (opcional)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.cantidad}
                onChange={(e) => actualizarForm({ cantidad: e.target.value })}
                placeholder="0.00"
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo
                label="Descripción"
                error={erroresForm.includes("La descripción es obligatoria") ? "Obligatorio" : undefined}
              >
                <Textarea
                  value={form.descripcion}
                  onChange={(e) => actualizarForm({ descripcion: e.target.value })}
                  placeholder="Describe el hallazgo, defecto o no conformidad…"
                  rows={3}
                />
              </Campo>
            </div>
          </div>
          {erroresForm.length > 0 ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {erroresForm.join(" · ")}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormAbierto(false)}>Cancelar</Button>
            <Button onClick={guardarIncidencia} disabled={guardando}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar transición de estado */}
      <Dialog
        open={Boolean(aTransicionar)}
        onOpenChange={(open) => !open && setATransicionar(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado de la incidencia</DialogTitle>
            <DialogDescription>
              {aTransicionar ? (
                <>
                  Pasar de <strong>{ESTADO_META[aTransicionar.estado]?.label}</strong> a{" "}
                  <strong>{ESTADO_META[nuevoEstado]?.label}</strong>. El cambio queda registrado en la
                  bitácora de auditoría.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setATransicionar(null)}>Cancelar</Button>
            <Button
              disabled={actualizando === aTransicionar?.id}
              onClick={() => aTransicionar && ejecutarTransicion(aTransicionar, nuevoEstado)}
            >
              {actualizando === aTransicionar?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
