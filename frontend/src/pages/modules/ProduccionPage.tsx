import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Factory,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Layers3,
  Trash2,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

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
import { areaAsignada, esAccesoGlobal } from "@/config/usuarios"
import { getMaquina } from "@/config/plantas"
import { api, getErrorMessage } from "@/lib/api"
import { formatNumber } from "@/lib/formatters"
import { puede } from "@/lib/permisos"
import { cn } from "@/lib/utils"

/** Orden de producción devuelta por GET /produccion/ordenes (backend) */
interface OrdenApi {
  id: string
  numero_op: string
  cliente: string
  producto: string
  descripcion: string | null
  unidad: string
  cantidad_planificada: number | null
  cantidad_producida: number
  prioridad: number
  estado: string
  fecha_emision: string | null
  fecha_programada: string | null
  fecha_fin_estimada: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_creacion: string | null
  planta_id: string
  area_id: string
  maquina_id: string
  operario_id: string | null
  turno_id: string | null
  planta_nombre?: string
  area_nombre?: string
  maquina_nombre?: string
  turno_nombre?: string
  operario_nombre?: string
  avance: number | null
}

interface CatalogoProduccion {
  plantas: { id: string; codigo: string; nombre: string }[]
  areas: { id: string; planta_id: string; codigo: string; nombre: string }[]
  maquinas: { id: string; planta_id: string; area_id: string; codigo: string; nombre: string }[]
  turnos: { id: string; planta_id: string; codigo: string; nombre: string }[]
  productos: { id: string; codigo: string; nombre: string; unidad: string }[]
}

interface RegistroDetalle {
  id: string
  fecha: string | null
  turno_id: string
  operario_id: string
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  unidad: string
  tiempo_operativo_min: number | null
  observaciones: string | null
}

interface ParadaDetalle {
  id: string
  motivo: string
  tipo: string
  inicio: string
  fin: string | null
  duracion_min: number | null
}

interface IncidenciaDetalle {
  id: string
  tipo: string
  codigo: string | null
  descripcion: string | null
  lote: string | null
  cantidad: number | null
  estado: string
  fecha: string | null
}

interface DetalleOrden {
  registros: RegistroDetalle[]
  paradas: ParadaDetalle[]
  incidencias: IncidenciaDetalle[]
}

interface FormOrden {
  planta_id: string
  area_id: string
  maquina_id: string
  cliente: string
  producto: string
  descripcion: string
  unidad: string
  cantidad_planificada: string
  prioridad: string
  turno_id: string
  fecha_emision: string
  fecha_programada: string
  fecha_fin_estimada: string
}

const FORM_VACIO: FormOrden = {
  planta_id: "",
  area_id: "",
  maquina_id: "",
  cliente: "",
  producto: "",
  descripcion: "",
  unidad: "t",
  cantidad_planificada: "",
  prioridad: "5",
  turno_id: "",
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_programada: "",
  fecha_fin_estimada: "",
}

const ESTADO_META: Record<string, { label: string; tone: BadgeProps["variant"]; transiciones: string[] }> = {
  borrador: { label: "Borrador", tone: "secondary", transiciones: ["asignada"] },
  asignada: { label: "Programada", tone: "secondary", transiciones: ["en_produccion", "cancelada"] },
  en_produccion: { label: "En proceso", tone: "success", transiciones: ["pausada", "finalizada"] },
  pausada: { label: "Pausada", tone: "warning", transiciones: ["en_produccion", "cancelada"] },
  finalizada: { label: "Finalizada", tone: "outline", transiciones: [] },
  cancelada: { label: "Cancelada", tone: "destructive", transiciones: [] },
}

const TIPO_INCIDENCIA: Record<string, string> = {
  defecto: "Defecto",
  inspeccion: "Inspección",
  nc: "No conformidad",
}

const ETIQUETAS_POR_FILA = [5, 10, 25]

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

export function ProduccionPage() {
  const { user } = useAuth()

  const [ordenes, setOrdenes] = useState<OrdenApi[]>([])
  const [catalogo, setCatalogo] = useState<CatalogoProduccion>({
    plantas: [],
    areas: [],
    maquinas: [],
    turnos: [],
    productos: [],
  })
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const [busqueda, setBusqueda] = useState("")
  const [fPlanta, setFPlanta] = useState("todas")
  const [fArea, setFArea] = useState("todas")
  const [fMaquina, setFMaquina] = useState("todas")
  const [fEstado, setFEstado] = useState("todos")
  const [fProducto, setFProducto] = useState("")
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")
  const [pagina, setPagina] = useState(0)
  const [filasPorPagina, setFilasPorPagina] = useState(10)

  const [verOrden, setVerOrden] = useState<OrdenApi | null>(null)
  const [detalle, setDetalle] = useState<DetalleOrden | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<OrdenApi | null>(null)
  const [form, setForm] = useState<FormOrden>(FORM_VACIO)
  const [erroresForm, setErroresForm] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const [cambiarEstadoDe, setCambiarEstadoDe] = useState<OrdenApi | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [aAnular, setAAnular] = useState<OrdenApi | null>(null)
  const [aEliminar, setAEliminar] = useState<OrdenApi | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const sePuede: Record<string, boolean> = useMemo(
    () => ({
      crear: puede(user, "op:crear"),
      asignar: puede(user, "op:asignar"),
      iniciar: puede(user, "op:iniciar"),
      finalizar: puede(user, "op:finalizar"),
      eliminar: puede(user, "op:eliminar"),
    }),
    [user],
  )

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const [rOrdenes, rCatalogo] = await Promise.all([
        api.get<{ ordenes: OrdenApi[] }>("/produccion/ordenes"),
        api.get<CatalogoProduccion>("/produccion/catalogo"),
      ])
      setOrdenes(rOrdenes.data.ordenes)
      setCatalogo(rCatalogo.data)
    } catch {
      setOrdenes([])
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarTodo()
  }, [cargarTodo])

  const global = esAccesoGlobal(user)

  /** Órdenes visibles según el rol (admin/supervisor: todas; operario: su máquina) */
  const ordenesVisibles = useMemo(() => {
    if (!user) return []
    if (global) return ordenes
    const asignacion = areaAsignada(user)
    const maquina = asignacion
      ? getMaquina(asignacion.plantaId, asignacion.seccionId, asignacion.maquinaId)?.nombre
      : undefined
    const operario = `${user.nombre} ${user.apellidos}`.trim()
    return ordenes.filter(
      (o) => (maquina && o.maquina_nombre === maquina) || o.operario_nombre === operario,
    )
  }, [ordenes, user, global])

  const areasVisibles = useMemo(
    () => catalogo.areas.filter((a) => fPlanta === "todas" || a.planta_id === fPlanta),
    [catalogo.areas, fPlanta],
  )

  const maquinasVisibles = useMemo(
    () =>
      catalogo.maquinas.filter(
        (m) =>
          (fPlanta === "todas" || m.planta_id === fPlanta) &&
          (fArea === "todas" || m.area_id === fArea),
      ),
    [catalogo.maquinas, fPlanta, fArea],
  )

  const filtrados = useMemo(() => {
    let filas = ordenesVisibles
    if (fPlanta !== "todas") filas = filas.filter((o) => o.planta_id === fPlanta)
    if (fArea !== "todas") filas = filas.filter((o) => o.area_id === fArea)
    if (fMaquina !== "todas") filas = filas.filter((o) => o.maquina_id === fMaquina)
    if (fEstado !== "todos") filas = filas.filter((o) => o.estado === fEstado)
    if (fProducto.trim()) {
      const term = fProducto.trim().toLowerCase()
      filas = filas.filter((o) => o.producto.toLowerCase().includes(term))
    }
    if (fDesde) filas = filas.filter((o) => !o.fecha_emision || o.fecha_emision >= fDesde)
    if (fHasta) filas = filas.filter((o) => !o.fecha_emision || o.fecha_emision <= fHasta)
    const term = busqueda.trim().toLowerCase()
    if (term) {
      filas = filas.filter((o) =>
        [o.numero_op, o.cliente, o.producto, o.planta_nombre, o.area_nombre, o.maquina_nombre,
          o.operario_nombre, ESTADO_META[o.estado]?.label]
          .some((v) => (v ?? "").toLowerCase().includes(term)),
      )
    }
    return filas
  }, [ordenesVisibles, fPlanta, fArea, fMaquina, fEstado, fProducto, fDesde, fHasta, busqueda])

  const kpis = useMemo(() => {
    const enProceso = filtrados.filter((o) => o.estado === "en_produccion").length
    const programadas = filtrados.filter(
      (o) => o.estado === "asignada" || o.estado === "borrador",
    ).length
    const finalizadas = filtrados.filter((o) => o.estado === "finalizada").length
    const cumplimiento = filtrados.length
      ? Math.round((finalizadas / filtrados.length) * 100)
      : 0
    return { total: filtrados.length, enProceso, programadas, cumplimiento }
  }, [filtrados])

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
    setFPlanta("todas")
    setFArea("todas")
    setFMaquina("todas")
    setFEstado("todos")
    setFProducto("")
    setFDesde("")
    setFHasta("")
    setPagina(0)
  }

  const abrirForm = (orden?: OrdenApi) => {
    setEditando(orden ?? null)
    setErroresForm([])
    setForm(orden ? formDesdeOrden(orden) : FORM_VACIO)
    setFormAbierto(true)
  }

  const actualizarForm = (patch: Partial<FormOrden>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErroresForm([])
  }

  const onProductoChange = (valor: string) => {
    const coincidencia = catalogo.productos.find((p) => `${p.codigo} · ${p.nombre}` === valor)
    actualizarForm({ producto: coincidencia ? coincidencia.nombre : valor })
  }

  const formAreas = catalogo.areas.filter((a) => a.planta_id === form.planta_id)
  const formMaquinas = catalogo.maquinas.filter(
    (m) => m.planta_id === form.planta_id && (!form.area_id || m.area_id === form.area_id),
  )
  const formTurnos = catalogo.turnos.filter((t) => !form.planta_id || t.planta_id === form.planta_id)

  const validarForm = (): string[] => {
    const errores: string[] = []
    if (!form.cliente.trim()) errores.push("El cliente es obligatorio")
    if (!form.producto.trim()) errores.push("El producto es obligatorio")
    if (!form.planta_id) errores.push("Selecciona una planta")
    if (!form.area_id) errores.push("Selecciona un área")
    if (!form.maquina_id) errores.push("Selecciona una máquina")
    const cantidad = parseFloat(form.cantidad_planificada)
    if (form.cantidad_planificada !== "" && (!Number.isFinite(cantidad) || cantidad <= 0)) {
      errores.push("La cantidad planificada debe ser mayor que cero")
    }
    if (form.fecha_fin_estimada) {
      if (form.fecha_emision && form.fecha_fin_estimada < form.fecha_emision) {
        errores.push("La fecha fin estimada no puede ser anterior a la fecha de emisión")
      }
      if (form.fecha_programada && form.fecha_fin_estimada < form.fecha_programada) {
        errores.push("La fecha fin estimada no puede ser anterior a la fecha programada")
      }
    }
    return errores
  }

  const guardarOrden = async () => {
    const errores = validarForm()
    if (errores.length > 0) {
      setErroresForm(errores)
      return
    }
    setGuardando(true)
    setErroresForm([])
    try {
      const body = {
        cliente: form.cliente.trim(),
        producto: form.producto.trim(),
        descripcion: form.descripcion.trim() || null,
        unidad: form.unidad.trim() || "t",
        cantidad_planificada:
          form.cantidad_planificada === ""
            ? null
            : parseFloat(form.cantidad_planificada),
        prioridad: parseInt(form.prioridad, 10) || 5,
        fecha_emision: form.fecha_emision || null,
        fecha_programada: form.fecha_programada || null,
        fecha_fin_estimada: form.fecha_fin_estimada || null,
        planta_id: form.planta_id,
        area_id: form.area_id,
        maquina_id: form.maquina_id,
        operario_id: null,
        turno_id: form.turno_id || null,
      }
      if (editando) {
        await api.put(`/produccion/ordenes/${editando.id}`, body)
      } else {
        await api.post("/produccion/ordenes", body)
      }
      setFormAbierto(false)
      setEditando(null)
      setPagina(0)
      await cargarTodo()
    } catch (error) {
      setErroresForm([getErrorMessage(error)])
    } finally {
      setGuardando(false)
    }
  }

  const ejecutarEstado = async (orden: OrdenApi, estado: string) => {
    setActualizando(orden.id)
    setErrorAccion(null)
    try {
      await api.post(`/produccion/ordenes/${orden.id}/estado`, { estado })
      await cargarTodo()
    } catch (error) {
      setErrorAccion(getErrorMessage(error))
    } finally {
      setActualizando(null)
    }
  }

  const confirmarAnular = async () => {
    if (!aAnular) return
    setActualizando(aAnular.id)
    setErrorAccion(null)
    try {
      await api.post(`/produccion/ordenes/${aAnular.id}/estado`, { estado: "cancelada" })
      setAAnular(null)
      await cargarTodo()
    } catch (error) {
      setErrorAccion(getErrorMessage(error))
    } finally {
      setActualizando(null)
    }
  }

  const confirmarEliminar = async () => {
    if (!aEliminar) return
    setBorrando(true)
    setErrorEliminar(null)
    try {
      await api.delete(`/produccion/ordenes/${aEliminar.id}`)
      setAEliminar(null)
      setPagina(0)
      await cargarTodo()
    } catch (error) {
      setErrorEliminar(getErrorMessage(error))
    } finally {
      setBorrando(false)
    }
  }

  const abrirDetalle = async (orden: OrdenApi) => {
    setVerOrden(orden)
    setDetalle(null)
    setCargandoDetalle(true)
    try {
      const [r, p, c] = await Promise.all([
        api.get<{ registros: RegistroDetalle[] }>("/produccion/registros", {
          params: { op_id: orden.id },
        }),
        api.get<{ paradas: ParadaDetalle[] }>("/produccion/paradas", {
          params: { op_id: orden.id },
        }),
        api.get<{ incidencias: IncidenciaDetalle[] }>("/produccion/calidad", {
          params: { op_id: orden.id },
        }),
      ])
      setDetalle({ registros: r.data.registros, paradas: p.data.paradas, incidencias: c.data.incidencias })
    } catch {
      setDetalle({ registros: [], paradas: [], incidencias: [] })
    } finally {
      setCargandoDetalle(false)
    }
  }

  const transicionesDe = (orden: OrdenApi) => ESTADO_META[orden.estado]?.transiciones ?? []

  const puedeAnular = (orden: OrdenApi) =>
    sePuede.asignar && orden.estado !== "cancelada" && transicionesDe(orden).includes("cancelada")

  const menuItems = (orden: OrdenApi) => {
    const items: { id: string; label: string; icon: LucideIcon; danger?: boolean; onClick: () => void }[] = []
    if (sePuede.iniciar && orden.estado === "asignada") {
      items.push({
        id: "iniciar",
        label: "Iniciar producción",
        icon: Play,
        onClick: () => void ejecutarEstado(orden, "en_produccion"),
      })
    }
    if (sePuede.finalizar && orden.estado === "en_produccion") {
      items.push({
        id: "finalizar",
        label: "Finalizar orden",
        icon: CheckCircle2,
        onClick: () => void ejecutarEstado(orden, "finalizada"),
      })
    }
    if (sePuede.asignar && transicionesDe(orden).length > 0) {
      items.push({
        id: "estado",
        label: "Cambiar estado",
        icon: Pencil,
        onClick: () => {
          setCambiarEstadoDe(orden)
          setNuevoEstado(ESTADO_META[orden.estado]?.transiciones[0] ?? "")
        },
      })
    }
    if (puedeAnular(orden)) {
      items.push({
        id: "anular",
        label: "Anular orden",
        icon: Ban,
        onClick: () => setAAnular(orden),
      })
    }
    if (sePuede.eliminar) {
      items.push({
        id: "eliminar",
        label: "Eliminar orden",
        icon: Trash2,
        danger: true,
        onClick: () => {
          setAEliminar(orden)
          setErrorEliminar(null)
        },
      })
    }
    return items
  }

  const detalleTotales = useMemo(() => {
    if (!detalle) return null
    const producida = detalle.registros.reduce((acc, r) => acc + r.produccion_total, 0)
    const buena = detalle.registros.reduce((acc, r) => acc + r.produccion_buena, 0)
    const rechazada = detalle.registros.reduce((acc, r) => acc + r.produccion_rechazada, 0)
    const tiempoActivo = detalle.registros.reduce(
      (acc, r) => acc + (r.tiempo_operativo_min ?? 0),
      0,
    )
    const tiempoParada = detalle.paradas.reduce((acc, p) => acc + (p.duracion_min ?? 0), 0)
    return { producida, buena, rechazada, tiempoActivo, tiempoParada }
  }, [detalle])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-1/15 text-chart-1">
            <ClipboardList className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Gestión de Órdenes de Producción</h1>
            <p className="text-sm text-muted-foreground">
              Consulta, crea y controla el ciclo de vida de las órdenes de producción
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" size="lg">
            <Link to="/cierre-turno">
              <CalendarClock className="mr-2 h-4 w-4" />
              Cierre de turno
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/produccion/captura">
              <Factory className="mr-2 h-4 w-4" />
              Registrar producción
            </Link>
          </Button>
          {sePuede.crear && (
            <Button size="lg" onClick={() => abrirForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={Layers3}
          label="Órdenes"
          valor={String(kpis.total)}
          tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
        />
        <Kpi
          icon={Factory}
          label="En proceso"
          valor={String(kpis.enProceso)}
          tone="text-chart-2 bg-chart-2/10 border-chart-2/20"
        />
        <Kpi
          icon={CalendarClock}
          label="Programadas"
          valor={String(kpis.programadas)}
          tone="text-chart-3 bg-chart-3/10 border-chart-3/20"
        />
        <Kpi
          icon={CheckCircle2}
          label="Cumplimiento"
          valor={`${kpis.cumplimiento}%`}
          tone="text-chart-4 bg-chart-4/10 border-chart-4/20"
        />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Campo label="Planta">
            <Select
              value={fPlanta}
              onValueChange={(v) => {
                setFPlanta(v)
                setFArea("todas")
                setFMaquina("todas")
                setPagina(0)
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {catalogo.plantas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Área">
            <Select
              value={fArea}
              onValueChange={(v) => {
                setFArea(v)
                setFMaquina("todas")
                setPagina(0)
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {areasVisibles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Máquina">
            <Select value={fMaquina} onValueChange={(v) => setFMaquina(v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {maquinasVisibles.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Estado">
            <Select
              value={fEstado}
              onValueChange={(v) => {
                setFEstado(v)
                setPagina(0)
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(ESTADO_META).map(([k, meta]) => (
                  <SelectItem key={k} value={k}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Producto">
            <Input
              value={fProducto}
              onChange={(e) => {
                setFProducto(e.target.value)
                setPagina(0)
              }}
              placeholder="Buscar por producto…"
              className="h-9"
            />
          </Campo>
          <Campo label="Fecha emisión desde">
            <Input
              type="date"
              value={fDesde}
              onChange={(e) => {
                setFDesde(e.target.value)
                setPagina(0)
              }}
              className="h-9"
            />
          </Campo>
          <Campo label="Fecha emisión hasta">
            <Input
              type="date"
              value={fHasta}
              onChange={(e) => {
                setFHasta(e.target.value)
                setPagina(0)
              }}
              className="h-9"
            />
          </Campo>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={limpiarFiltros} className="h-9 w-full">
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {errorAccion && (
          <div className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
            <span>{errorAccion}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setErrorAccion(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando órdenes…
          </div>
        ) : errorCarga ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ClipboardList className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-semibold">No fue posible cargar las órdenes</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Intenta nuevamente en unos momentos.
            </p>
            <Button variant="outline" size="sm" onClick={() => void cargarTodo()}>
              Reintentar
            </Button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ClipboardList className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-sm font-semibold">Sin órdenes para mostrar</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {ordenesVisibles.length === 0
                ? "Las órdenes de producción aparecerán aquí al crearlas. Crea tu primera orden para empezar."
                : "Ajuste los filtros para ver las órdenes disponibles."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    setPagina(0)
                  }}
                  placeholder="Buscar por OP, producto, cliente, máquina…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {filtrados.length} {filtrados.length === 1 ? "orden" : "órdenes"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-3 py-3">Producto</th>
                    <th className="hidden px-3 py-3 xl:table-cell">Planta</th>
                    <th className="hidden px-3 py-3 lg:table-cell">Área</th>
                    <th className="hidden px-3 py-3 md:table-cell">Máquina</th>
                    <th className="px-3 py-3 text-right">Cantidad</th>
                    <th className="px-3 py-3">Fecha inicio</th>
                    <th className="px-3 py-3">Fecha fin estimada</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Avance</th>
                    <th className="w-28 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filasPagina.map((o) => {
                    const meta = ESTADO_META[o.estado] ?? { label: o.estado, tone: "secondary", transiciones: [] }
                    const items = menuItems(o)
                    return (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-bold text-primary">{o.numero_op}</p>
                          <p className="text-xs text-muted-foreground">{o.cliente}</p>
                        </td>
                        <td className="max-w-[180px] px-3 py-3">
                          <p className="truncate font-semibold">{o.producto}</p>
                          {o.descripcion && (
                            <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                              {o.descripcion}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-xs xl:table-cell">
                          {o.planta_nombre ?? o.planta_id}
                        </td>
                        <td className="hidden px-3 py-3 text-xs lg:table-cell">
                          {o.area_nombre ?? o.area_id}
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                            {o.maquina_nombre ?? o.maquina_id}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <p className="font-semibold">
                            {formatNumber(o.cantidad_planificada ?? o.cantidad_producida, 1)}
                          </p>
                          <p className="text-xs text-muted-foreground">{o.unidad} · prioridad {o.prioridad}</p>
                        </td>
                        <td className="px-3 py-3 text-xs">{o.fecha_emision ?? "—"}</td>
                        <td className="px-3 py-3 text-xs">
                          {o.fecha_fin_estimada ? (
                            o.fecha_fin_estimada
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  (o.avance ?? 0) >= 100
                                    ? "bg-chart-3"
                                    : (o.avance ?? 0) > 0
                                      ? "bg-chart-1"
                                      : "bg-muted-foreground/40",
                                )}
                                style={{ width: `${o.avance ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums text-muted-foreground">
                              {o.avance ?? 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver detalle"
                              onClick={() => void abrirDetalle(o)}
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {sePuede.asignar && o.estado !== "finalizada" && o.estado !== "cancelada" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar orden"
                                onClick={() => abrirForm(o)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {items.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Más acciones"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {items.map((item) => (
                                    <DropdownMenuItem
                                      key={item.id}
                                      disabled={actualizando === o.id}
                                      className={item.danger ? "text-destructive focus:text-destructive" : undefined}
                                      onClick={item.onClick}
                                    >
                                      <item.icon className="mr-2 h-4 w-4" />
                                      {item.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
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
                <span className="font-semibold text-foreground">{filtrados.length}</span> órdenes
              </p>
              <div className="flex items-center gap-3">
                <Select
                  value={String(filasPorPagina)}
                  onValueChange={(v) => {
                    setFilasPorPagina(parseInt(v, 10))
                    setPagina(0)
                  }}
                >
                  <SelectTrigger className="h-8 w-24">
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

      {/* ── Detalle de la orden ─────────────────────────────────────────── */}
      <Dialog open={Boolean(verOrden)} onOpenChange={(open) => !open && setVerOrden(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{verOrden?.numero_op}</span>
              {verOrden && (
                <Badge variant={ESTADO_META[verOrden.estado]?.tone ?? "secondary"}>
                  {ESTADO_META[verOrden.estado]?.label ?? verOrden.estado}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Detalle completo de la orden de producción</DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle…
            </div>
          ) : verOrden && detalle && detalleTotales ? (
            <div className="space-y-5">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Información general
                </p>
                <div className="grid gap-x-6 gap-y-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{verOrden.cliente}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Producto</p>
                    <p className="font-semibold">{verOrden.producto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Planta · Área · Máquina</p>
                    <p className="font-semibold">
                      {verOrden.planta_nombre ?? "—"} · {verOrden.area_nombre ?? "—"} ·{" "}
                      {verOrden.maquina_nombre ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Turno · Operario</p>
                    <p className="font-semibold">
                      {verOrden.turno_nombre ?? "—"} · {verOrden.operario_nombre ?? "Sin asignar"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prioridad</p>
                    <p className="font-semibold">{verOrden.prioridad} de 10</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Descripción</p>
                    <p className="font-semibold">{verOrden.descripcion ?? "—"}</p>
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Fechas
                </p>
                <div className="grid gap-x-6 gap-y-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Emisión</p>
                    <p className="font-semibold">{verOrden.fecha_emision ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Programada</p>
                    <p className="font-semibold">{verOrden.fecha_programada ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fin estimada</p>
                    <p className="font-semibold">{verOrden.fecha_fin_estimada ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inicio real</p>
                    <p className="font-semibold">
                      {verOrden.fecha_inicio ? new Date(verOrden.fecha_inicio).toLocaleString("es") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fin real</p>
                    <p className="font-semibold">
                      {verOrden.fecha_fin ? new Date(verOrden.fecha_fin).toLocaleString("es") : "—"}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Producción
                </p>
                <div className="grid gap-x-6 gap-y-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Planificada</p>
                    <p className="font-semibold tabular-nums">
                      {verOrden.cantidad_planificada != null
                        ? `${formatNumber(verOrden.cantidad_planificada, 1)} ${verOrden.unidad}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Producida</p>
                    <p className="font-semibold tabular-nums">
                      {formatNumber(detalleTotales.producida, 1)} {verOrden.unidad}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buena · Rechazada</p>
                    <p className="font-semibold tabular-nums">
                      {formatNumber(detalleTotales.buena, 1)} · {formatNumber(detalleTotales.rechazada, 1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avance</p>
                    <p className="font-semibold tabular-nums">{verOrden.avance ?? 0}%</p>
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tiempos
                </p>
                <div className="grid gap-x-6 gap-y-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Turnos registrados</p>
                    <p className="font-semibold tabular-nums">{detalle.registros.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tiempo operativo</p>
                    <p className="font-semibold tabular-nums">
                      {formatDurationMin(detalleTotales.tiempoActivo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tiempo de paradas</p>
                    <p className="font-semibold tabular-nums">
                      {formatDurationMin(detalleTotales.tiempoParada)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({detalle.paradas.length} paradas)
                      </span>
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Calidad
                </p>
                {detalle.incidencias.length === 0 ? (
                  <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Sin incidencias registradas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detalle.incidencias.map((i) => (
                      <div key={i.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {TIPO_INCIDENCIA[i.tipo] ?? i.tipo}
                          </Badge>
                          {i.codigo && (
                            <span className="font-mono text-xs">{i.codigo}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{i.fecha ?? "—"}</span>
                        </div>
                        <p className="mt-1">{i.descripcion ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Trazabilidad · Registros por turno
                </p>
                {detalle.registros.length === 0 ? (
                  <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Sin registros diarios todavía.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Buena</th>
                          <th className="px-3 py-2 text-right">Rechazada</th>
                          <th className="px-3 py-2 text-right">Tiempo operativo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.registros.map((r) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="px-3 py-2 text-xs">{r.fecha ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(r.produccion_total, 1)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-chart-3">
                              {formatNumber(r.produccion_buena, 1)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-destructive">
                              {formatNumber(r.produccion_rechazada, 1)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums">
                              {formatDurationMin(r.tiempo_operativo_min ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Crear / editar orden ────────────────────────────────────────── */}
      <Dialog
        open={formAbierto}
        onOpenChange={(open) => {
          if (!open && !guardando) {
            setFormAbierto(false)
            setEditando(null)
            setErroresForm([])
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.numero_op}` : "Nueva orden de producción"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Actualiza la información de la orden (no está permitido en órdenes finalizadas o canceladas)."
                : "La numeración (OP-AAAA-NNNN) se genera automáticamente."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Planta" error={erroresForm.find((e) => e.includes("planta"))}>
              <Select
                value={form.planta_id}
                onValueChange={(v) =>
                  actualizarForm({ planta_id: v, area_id: "", maquina_id: "", turno_id: "" })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Selecciona una planta" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.plantas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Área" error={erroresForm.find((e) => e.includes("área"))}>
              <Select
                value={form.area_id}
                disabled={!form.planta_id}
                onValueChange={(v) => actualizarForm({ area_id: v, maquina_id: "" })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={form.planta_id ? "Selecciona un área" : "Elige la planta primero"} />
                </SelectTrigger>
                <SelectContent>
                  {formAreas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Máquina" error={erroresForm.find((e) => e.includes("máquina"))}>
              <Select
                value={form.maquina_id}
                disabled={!form.area_id}
                onValueChange={(v) => actualizarForm({ maquina_id: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={form.area_id ? "Selecciona una máquina" : "Elige el área primero"} />
                </SelectTrigger>
                <SelectContent>
                  {formMaquinas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.codigo} · {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Turno">
              <Select
                value={form.turno_id}
                onValueChange={(v) => actualizarForm({ turno_id: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Sin turno asignado" />
                </SelectTrigger>
                <SelectContent>
                  {formTurnos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.codigo} · {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Cliente *" error={erroresForm.find((e) => e.includes("cliente"))}>
              <Input
                value={form.cliente}
                onChange={(e) => actualizarForm({ cliente: e.target.value })}
                placeholder="Nombre del cliente"
                className="h-9"
              />
            </Campo>
            <Campo label="Producto *" error={erroresForm.find((e) => e.includes("producto"))}>
              <Input
                value={form.producto}
                onChange={(e) => onProductoChange(e.target.value)}
                placeholder="Producto a fabricar"
                list="lista-productos-op"
                className="h-9"
              />
              <datalist id="lista-productos-op">
                {catalogo.productos.map((p) => (
                  <option key={p.id} value={`${p.codigo} · ${p.nombre}`} />
                ))}
              </datalist>
            </Campo>
            <Campo label="Cantidad planificada" error={erroresForm.find((e) => e.includes("cantidad"))}>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={form.cantidad_planificada}
                onChange={(e) => actualizarForm({ cantidad_planificada: e.target.value })}
                placeholder="0"
                className="h-9"
              />
            </Campo>
            <Campo label="Unidad">
              <Input
                value={form.unidad}
                onChange={(e) => actualizarForm({ unidad: e.target.value })}
                placeholder="t"
                className="h-9"
              />
            </Campo>
            <Campo label="Prioridad (1–10)">
              <Select
                value={form.prioridad}
                onValueChange={(v) => actualizarForm({ prioridad: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Fecha de emisión" error={erroresForm.find((e) => e.includes("emisión"))}>
              <Input
                type="date"
                disabled={Boolean(editando)}
                value={form.fecha_emision}
                onChange={(e) => actualizarForm({ fecha_emision: e.target.value })}
                className="h-9"
              />
            </Campo>
            <Campo label="Fecha programada">
              <Input
                type="date"
                value={form.fecha_programada}
                onChange={(e) => actualizarForm({ fecha_programada: e.target.value })}
                className="h-9"
              />
            </Campo>
            <Campo label="Fecha fin estimada" error={erroresForm.find((e) => e.includes("fin estimada"))}>
              <Input
                type="date"
                value={form.fecha_fin_estimada}
                onChange={(e) => actualizarForm({ fecha_fin_estimada: e.target.value })}
                className="h-9"
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Descripción / observaciones">
                <Textarea
                  value={form.descripcion}
                  onChange={(e) => actualizarForm({ descripcion: e.target.value })}
                  placeholder="Detalles adicionales de la orden (opcional)"
                  rows={2}
                />
              </Campo>
            </div>
          </div>

          {erroresForm.length > 0 && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {erroresForm.map((e) => (
                <p key={e} className="text-sm font-medium text-destructive">
                  {e}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={guardando}
              onClick={() => {
                setFormAbierto(false)
                setEditando(null)
                setErroresForm([])
              }}
            >
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => void guardarOrden()}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cambiar estado ──────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(cambiarEstadoDe)}
        onOpenChange={(open) => {
          if (!open && !actualizando) setCambiarEstadoDe(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado de {cambiarEstadoDe?.numero_op}</DialogTitle>
            <DialogDescription>
              {cambiarEstadoDe
                ? `Estado actual: ${ESTADO_META[cambiarEstadoDe.estado]?.label ?? cambiarEstadoDe.estado}. Elegí el nuevo estado.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {cambiarEstadoDe && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Nuevo estado
              </p>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(ESTADO_META[cambiarEstadoDe.estado]?.transiciones ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ESTADO_META[t]?.label ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(actualizando)}
              onClick={() => setCambiarEstadoDe(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!nuevoEstado || Boolean(actualizando)}
              onClick={() => {
                if (!cambiarEstadoDe) return
                const orden = cambiarEstadoDe
                setCambiarEstadoDe(null)
                void ejecutarEstado(orden, nuevoEstado)
              }}
            >
              {actualizando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actualizando ? "Actualizando…" : "Confirmar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Anular orden ────────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(aAnular)}
        onOpenChange={(open) => {
          if (!open && !actualizando) setAAnular(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Anular orden?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas anular {aAnular?.numero_op}? La orden quedará cancelada y
              conservará su trazabilidad para auditoría. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(actualizando)} onClick={() => setAAnular(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={Boolean(actualizando)} onClick={() => void confirmarAnular()}>
              {actualizando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actualizando ? "Anulando…" : "Anular orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar orden ──────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(aEliminar)}
        onOpenChange={(open) => {
          if (!open && !borrando) {
            setAEliminar(null)
            setErrorEliminar(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar orden?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar {aEliminar?.numero_op}? Esta acción no se puede
              deshacer y solo es posible si la orden no tiene registros, paradas ni incidencias
              asociados.
            </DialogDescription>
          </DialogHeader>
          {errorEliminar && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {errorEliminar}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={borrando}
              onClick={() => {
                setAEliminar(null)
                setErrorEliminar(null)
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={borrando} onClick={() => void confirmarEliminar()}>
              {borrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {borrando ? "Eliminando…" : "Eliminar orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Rellena el formulario con los valores de una orden existente */
function formDesdeOrden(orden: OrdenApi): FormOrden {
  return {
    planta_id: orden.planta_id,
    area_id: orden.area_id,
    maquina_id: orden.maquina_id,
    cliente: orden.cliente,
    producto: orden.producto,
    descripcion: orden.descripcion ?? "",
    unidad: orden.unidad,
    cantidad_planificada:
      orden.cantidad_planificada != null ? String(orden.cantidad_planificada) : "",
    prioridad: String(orden.prioridad),
    turno_id: orden.turno_id ?? "",
    fecha_emision: orden.fecha_emision ?? "",
    fecha_programada: orden.fecha_programada ?? "",
    fecha_fin_estimada: orden.fecha_fin_estimada ?? "",
  }
}

function formatDurationMin(minutos: number): string {
  if (minutos <= 0) return "0 min"
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}