import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Archive,
  ArchiveX,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Warehouse,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { api, getErrorMessage } from "@/lib/api"
import { formatDate, formatNumber } from "@/lib/formatters"
import { puede } from "@/lib/permisos"
import { cn } from "@/lib/utils"

interface ProductoApi {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  unidad: string
  activo: boolean
  fecha_creacion: string | null
}

interface LineaStock {
  producto_id: string
  producto_codigo: string | null
  producto_nombre: string | null
  unidad: string | null
  planta_id: string
  planta_codigo: string | null
  planta_nombre: string | null
  cantidad: number
}

interface MovimientoApi {
  id: string
  producto_id: string
  producto_codigo?: string | null
  producto_nombre?: string | null
  unidad?: string | null
  planta_id: string
  planta_codigo?: string | null
  planta_nombre?: string | null
  tipo: string
  cantidad: number
  referencia: string | null
  motivo: string
  fecha: string | null
}

interface RespuestaMovimientos {
  total: number
  limit: number
  offset: number
  movimientos: MovimientoApi[]
}

const TIPO_META: Record<string, { label: string; tone: BadgeProps["variant"] }> = {
  entrada: { label: "Entrada", tone: "success" },
  salida: { label: "Salida", tone: "destructive" },
  ajuste: { label: "Ajuste", tone: "warning" },
}

const TIPOS = Object.keys(TIPO_META)
const ETIQUETAS_POR_FILA = [25, 50, 100]

const TIPO_ICON: Record<string, LucideIcon> = {
  entrada: ArrowDownLeft,
  salida: ArrowUpRight,
  ajuste: SlidersHorizontal,
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

function SelectorVista({
  vista,
  onChange,
}: {
  vista: string
  onChange: (v: "stock" | "movimientos" | "productos") => void
}) {
  const opciones: { key: "stock" | "movimientos" | "productos"; label: string }[] = [
    { key: "stock", label: "Stock" },
    { key: "movimientos", label: "Movimientos" },
    { key: "productos", label: "Productos" },
  ]
  return (
    <div className="inline-flex rounded-xl border bg-card p-1 shadow-card">
      {opciones.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
            vista === o.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ProductoCelda({
  codigo,
  nombre,
  unidad,
}: {
  codigo: string | null
  nombre: string | null
  unidad?: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2">
        <span className="truncate font-semibold">{nombre ?? "—"}</span>
        {codigo && <Badge variant="outline" className="shrink-0 font-mono">{codigo}</Badge>}
      </span>
      {unidad && <span className="text-xs text-muted-foreground">Unidad: {unidad}</span>}
    </div>
  )
}

export function InventarioPage() {
  const { user } = useAuth()

  const [vista, setVista] = useState<"stock" | "movimientos" | "productos">("stock")

  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [productos, setProductos] = useState<ProductoApi[]>([])
  const [stock, setStock] = useState<LineaStock[]>([])
  const [respMov, setRespMov] = useState<RespuestaMovimientos>({
    total: 0,
    limit: 25,
    offset: 0,
    movimientos: [],
  })

  const [fProducto, setFProducto] = useState("todos")
  const [fPlanta, setFPlanta] = useState("todos")
  const [fTipo, setFTipo] = useState("todos")
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")
  const [aplicados, setAplicados] = useState({ desde: "", hasta: "" })
  const [pagina, setPagina] = useState(0)
  const [filasPorPagina, setFilasPorPagina] = useState(25)

  const [registrarAbierto, setRegistrarAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const [productoDialog, setProductoDialog] = useState<{ abierto: boolean; editando: ProductoApi | null }>({
    abierto: false,
    editando: null,
  })
  const [guardandoProducto, setGuardandoProducto] = useState(false)
  const [errorProducto, setErrorProducto] = useState<string | null>(null)
  const [productoADesactivar, setProductoADesactivar] = useState<ProductoApi | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  const puedeVer = useMemo(() => puede(user, "inventario:ver"), [user])
  const puedeRegistrar = useMemo(() => puede(user, "inventario:registrar"), [user])
  const puedeConfigurar = useMemo(() => puede(user, "inventario:configurar"), [user])

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const [rProductos, rStock] = await Promise.all([
        api.get<{ productos: ProductoApi[] }>("/inventario/productos"),
        api.get<{ stock: LineaStock[] }>("/inventario/stock"),
      ])
      setProductos(rProductos.data.productos)
      setStock(rStock.data.stock)
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarMovimientos = useCallback(async () => {
    try {
      const r = await api.get<RespuestaMovimientos>("/inventario/movimientos", {
        params: {
          producto_id: fProducto === "todos" ? undefined : fProducto,
          planta_id: fPlanta === "todos" ? undefined : fPlanta,
          tipo: fTipo === "todos" ? undefined : fTipo,
          fecha_desde: aplicados.desde || undefined,
          fecha_hasta: aplicados.hasta || undefined,
          limit: filasPorPagina,
          offset: pagina * filasPorPagina,
        },
      })
      setRespMov(r.data)
    } catch {
      setRespMov({ total: 0, limit: filasPorPagina, offset: 0, movimientos: [] })
    }
  }, [fProducto, fPlanta, fTipo, aplicados, filasPorPagina, pagina])

  useEffect(() => {
    if (puedeVer) void cargarTodo()
  }, [puedeVer, cargarTodo])

  useEffect(() => {
    if (vista === "movimientos" && puedeVer) void cargarMovimientos()
  }, [vista, puedeVer, cargarMovimientos])

  const plantasDisponibles = useMemo(() => {
    const mapa = new Map<string, { codigo: string | null; nombre: string | null }>()
    for (const l of stock) {
      mapa.set(l.planta_id, { codigo: l.planta_codigo, nombre: l.planta_nombre })
    }
    for (const m of respMov.movimientos) {
      if (!mapa.has(m.planta_id)) {
        mapa.set(m.planta_id, { codigo: m.planta_codigo ?? null, nombre: m.planta_nombre ?? null })
      }
    }
    return [...mapa.entries()].map(([id, v]) => ({ id, ...v }))
  }, [stock, respMov.movimientos])

  const stockFiltrado = useMemo(() => {
    if (fPlanta === "todos") return stock
    return stock.filter((l) => l.planta_id === fPlanta)
  }, [stock, fPlanta])

  const kpis = useMemo(() => {
    const activos = productos.filter((p) => p.activo).length
    const agotados = stock.filter((l) => l.cantidad <= 0).length
    return { activos, lineas: stock.length, agotados, movimientos: respMov.total }
  }, [productos, stock, respMov.total])

  const aplicarFiltros = () => {
    setAplicados({ desde: fDesde, hasta: fHasta })
    setPagina(0)
  }

  const limpiarFiltros = () => {
    setFProducto("todos")
    setFPlanta("todos")
    setFTipo("todos")
    setFDesde("")
    setFHasta("")
    setAplicados({ desde: "", hasta: "" })
    setPagina(0)
  }

  const totalPaginas = Math.max(1, Math.ceil(respMov.total / filasPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const inicioMostrado = respMov.total === 0 ? 0 : paginaSegura * filasPorPagina + 1
  const finMostrado = Math.min(respMov.total, paginaSegura * filasPorPagina + filasPorPagina)

  const recargarTrasMovimiento = useCallback(() => {
    void cargarTodo()
    if (vista === "movimientos") void cargarMovimientos()
  }, [cargarTodo, cargarMovimientos, vista])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
            <Warehouse className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inventario</h1>
            <p className="text-sm text-muted-foreground">
              Existencias por producto y planta, movimientos y ajustes de stock
            </p>
          </div>
        </div>
        {puedeRegistrar && (
          <Button onClick={() => { setRegistrarAbierto(true); setErrorForm(null) }}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Registrar movimiento
          </Button>
        )}
      </div>

      {!puedeVer ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-sm font-semibold">No tienes permiso para consultar el inventario</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Contacta a un administrador para solicitar acceso a este módulo.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              icon={Package}
              label="Productos activos"
              valor={String(kpis.activos)}
              tone="text-chart-1 bg-chart-1/10 border-chart-1/20"
            />
            <Kpi
              icon={Boxes}
              label="Líneas de stock"
              valor={String(kpis.lineas)}
              tone="text-chart-3 bg-chart-3/10 border-chart-3/20"
            />
            <Kpi
              icon={ArchiveX}
              label="Productos agotados"
              valor={String(kpis.agotados)}
              tone="text-chart-5 bg-chart-5/10 border-chart-5/20"
            />
            <Kpi
              icon={ArrowLeftRight}
              label="Movimientos registrados"
              valor={new Intl.NumberFormat("es-MX").format(kpis.movimientos)}
              tone="text-chart-4 bg-chart-4/10 border-chart-4/20"
            />
          </div>

          <SelectorVista vista={vista} onChange={(v) => { setVista(v); setPagina(0) }} />

          {vista === "stock" && (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
              {cargando ? (
                <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando stock…
                </div>
              ) : errorCarga ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <Archive className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <p className="text-sm font-semibold">No fue posible cargar el stock</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    Intenta nuevamente en unos momentos.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void cargarTodo()}>
                    Reintentar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {stockFiltrado.length} {stockFiltrado.length === 1 ? "línea de stock" : "líneas de stock"}
                    </p>
                    <Select value={fPlanta} onValueChange={setFPlanta}>
                      <SelectTrigger className="h-8 w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas las plantas</SelectItem>
                        {plantasDisponibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo ?? "—"} · {p.nombre ?? "—"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {stockFiltrado.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Archive className="h-7 w-7" strokeWidth={1.5} />
                      </span>
                      <p className="mt-4 text-sm font-semibold">Sin stock que mostrar</p>
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        Registra movimientos de inventario para comenzar a llevar existencias.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-3 py-3">Planta</th>
                            <th className="hidden px-3 py-3 md:table-cell">Unidad</th>
                            <th className="px-3 py-3 text-right">Cantidad</th>
                            <th className="px-3 py-3 text-right">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockFiltrado.map((l) => (
                            <tr key={`${l.producto_id}-${l.planta_id}`} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-3">
                                <ProductoCelda codigo={l.producto_codigo} nombre={l.producto_nombre} />
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-xs font-semibold">
                                  {l.planta_codigo ?? "—"} · {l.planta_nombre ?? "—"}
                                </span>
                              </td>
                              <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                                {l.unidad ?? "—"}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-3 text-right font-bold tabular-nums",
                                  l.cantidad > 0 ? "text-chart-3" : "text-destructive",
                                )}
                              >
                                {formatNumber(l.cantidad, 2)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Badge variant={l.cantidad > 0 ? "success" : "destructive"}>
                                  {l.cantidad > 0 ? "Disponible" : "Agotado"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {vista === "movimientos" && (
            <>
              <div className="rounded-2xl border bg-card p-4 shadow-card">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Producto
                    </p>
                    <Select
                      value={fProducto}
                      onValueChange={(v) => { setFProducto(v); setPagina(0) }}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {productos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} · {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Planta
                    </p>
                    <Select
                      value={fPlanta}
                      onValueChange={(v) => { setFPlanta(v); setPagina(0) }}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        {plantasDisponibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo ?? "—"} · {p.nombre ?? "—"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tipo
                    </p>
                    <Select
                      value={fTipo}
                      onValueChange={(v) => { setFTipo(v); setPagina(0) }}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TIPO_META[t]?.label ?? t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Desde
                    </p>
                    <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Hasta
                    </p>
                    <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={limpiarFiltros}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Limpiar
                  </Button>
                  <Button size="sm" className="h-9" onClick={aplicarFiltros}>
                    <Search className="mr-2 h-3.5 w-3.5" />
                    Aplicar
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
                {respMov.total === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <ArchiveX className="h-7 w-7" strokeWidth={1.5} />
                    </span>
                    <p className="mt-4 text-sm font-semibold">Sin movimientos que mostrar</p>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      Ajusta los filtros o registra un nuevo movimiento de inventario.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-b px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {respMov.total} {respMov.total === 1 ? "movimiento" : "movimientos"}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-3 py-3">Producto</th>
                            <th className="hidden px-3 py-3 lg:table-cell">Planta</th>
                            <th className="px-3 py-3">Tipo</th>
                            <th className="px-3 py-3 text-right">Cantidad</th>
                            <th className="hidden px-3 py-3 md:table-cell">Motivo</th>
                            <th className="hidden px-3 py-3 xl:table-cell">Referencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {respMov.movimientos.map((m) => {
                            const TipoIcon = TIPO_ICON[m.tipo] ?? ArrowLeftRight
                            return (
                              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-4 py-3 text-xs tabular-nums">
                                  {formatDate(m.fecha ?? "")}
                                </td>
                                <td className="px-3 py-3">
                                  <ProductoCelda
                                    codigo={m.producto_codigo ?? null}
                                    nombre={m.producto_nombre ?? null}
                                    unidad={m.unidad}
                                  />
                                </td>
                                <td className="hidden px-3 py-3 text-xs font-semibold lg:table-cell">
                                  {m.planta_codigo ?? "—"} · {m.planta_nombre ?? "—"}
                                </td>
                                <td className="px-3 py-3">
                                  <Badge variant={TIPO_META[m.tipo]?.tone ?? "secondary"}>
                                    <TipoIcon className="mr-1 h-3 w-3" />
                                    {TIPO_META[m.tipo]?.label ?? m.tipo}
                                  </Badge>
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-3 text-right font-bold tabular-nums",
                                    m.cantidad > 0 ? "text-chart-3" : "text-destructive",
                                  )}
                                >
                                  {m.cantidad > 0 ? "+" : ""}
                                  {formatNumber(m.cantidad, 2)}
                                </td>
                                <td className="hidden max-w-[220px] truncate px-3 py-3 text-xs text-muted-foreground md:table-cell">
                                  {m.motivo}
                                </td>
                                <td className="hidden px-3 py-3 font-mono text-xs xl:table-cell">
                                  {m.referencia ?? "—"}
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
                        <span className="font-semibold text-foreground">{respMov.total}</span> movimientos
                      </p>
                      <div className="flex items-center gap-3">
                        <Select
                          value={String(filasPorPagina)}
                          onValueChange={(v) => { setFilasPorPagina(parseInt(v, 10)); setPagina(0) }}
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
            </>
          )}

          {vista === "productos" && (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {productos.length} {productos.length === 1 ? "producto" : "productos"} en el catálogo
                </p>
                {puedeConfigurar && (
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => { setProductoDialog({ abierto: true, editando: null }); setErrorProducto(null) }}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Nuevo producto
                  </Button>
                )}
              </div>
              {productos.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Package className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <p className="mt-4 text-sm font-semibold">Sin productos en el catálogo</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Crea el catálogo de referencias para registrar movimientos de stock.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Código</th>
                        <th className="px-3 py-3">Producto</th>
                        <th className="hidden px-3 py-3 md:table-cell">Unidad</th>
                        <th className="px-3 py-3">Estado</th>
                        <th className="hidden px-3 py-3 lg:table-cell">Creado</th>
                        <th className="w-20 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="font-mono">{p.codigo}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-semibold">{p.nombre}</span>
                              {p.descripcion && (
                                <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                                  {p.descripcion}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                            {p.unidad}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={p.activo ? "success" : "outline"}>
                              {p.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
                            {formatDate(p.fecha_creacion ?? "")}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {puedeConfigurar && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Editar producto"
                                  onClick={() => { setProductoDialog({ abierto: true, editando: p }); setErrorProducto(null) }}
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {p.activo && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Desactivar producto"
                                    onClick={() => setProductoADesactivar(p)}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {puedeRegistrar && (
            <DialogRegistrarMovimiento
              abierto={registrarAbierto}
              onClose={() => setRegistrarAbierto(false)}
              productos={productos}
              plantas={plantasDisponibles}
              guardando={guardando}
              error={errorForm}
              onGuardar={async (datos) => {
                setGuardando(true)
                setErrorForm(null)
                try {
                  await api.post("/inventario/movimientos", {
                    producto_id: datos.producto_id,
                    planta_id: datos.planta_id,
                    tipo: datos.tipo,
                    cantidad: datos.cantidad,
                    motivo: datos.motivo,
                    referencia: datos.referencia || undefined,
                    fecha: datos.fecha,
                  })
                  setRegistrarAbierto(false)
                  recargarTrasMovimiento()
                } catch (err) {
                  setErrorForm(getErrorMessage(err))
                } finally {
                  setGuardando(false)
                }
              }}
            />
          )}

          {puedeConfigurar && (
            <DialogProducto
              abierto={productoDialog.abierto}
              editando={productoDialog.editando}
              onClose={() => setProductoDialog({ abierto: false, editando: null })}
              guardando={guardandoProducto}
              error={errorProducto}
              onGuardar={async (datos) => {
                setGuardandoProducto(true)
                setErrorProducto(null)
                try {
                  if (productoDialog.editando) {
                    await api.put(`/inventario/productos/${productoDialog.editando.id}`, datos)
                  } else {
                    await api.post("/inventario/productos", datos)
                  }
                  setProductoDialog({ abierto: false, editando: null })
                  await cargarTodo()
                } catch (err) {
                  setErrorProducto(getErrorMessage(err))
                } finally {
                  setGuardandoProducto(false)
                }
              }}
            />
          )}

          {puedeConfigurar && productoADesactivar && (
            <Dialog open onOpenChange={(open) => !open && setProductoADesactivar(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Desactivar producto</DialogTitle>
                  <DialogDescription>
                    El producto <span className="font-semibold text-foreground">{productoADesactivar.codigo}</span>{" "}
                    dejará de estar disponible para nuevos movimientos de inventario.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setProductoADesactivar(null)}
                    disabled={desactivando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={desactivando}
                    onClick={async () => {
                      setDesactivando(true)
                      try {
                        await api.delete(`/inventario/productos/${productoADesactivar.id}`)
                        setProductoADesactivar(null)
                        await cargarTodo()
                      } catch (err) {
                        setErrorProducto(getErrorMessage(err))
                        setProductoADesactivar(null)
                      } finally {
                        setDesactivando(false)
                      }
                    }}
                  >
                    {desactivando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Desactivar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  )
}

interface DatosMovimiento {
  producto_id: string
  planta_id: string
  tipo: string
  cantidad: number
  motivo: string
  referencia: string
  fecha: string
}

function DialogRegistrarMovimiento({
  abierto,
  onClose,
  productos,
  plantas,
  guardando,
  error,
  onGuardar,
}: {
  abierto: boolean
  onClose: () => void
  productos: ProductoApi[]
  plantas: { id: string; codigo: string | null; nombre: string | null }[]
  guardando: boolean
  error: string | null
  onGuardar: (datos: DatosMovimiento) => Promise<void>
}) {
  const [tipo, setTipo] = useState("entrada")
  const [productoId, setProductoId] = useState("")
  const [plantaId, setPlantaId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("")
  const [referencia, setReferencia] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [validacion, setValidacion] = useState<string | null>(null)

  const activos = productos.filter((p) => p.activo)

  const reiniciar = () => {
    setTipo("entrada")
    setProductoId("")
    setPlantaId("")
    setCantidad("")
    setMotivo("")
    setReferencia("")
    setFecha(new Date().toISOString().slice(0, 10))
    setValidacion(null)
  }

  const enviar = () => {
    const valor = parseFloat(cantidad)
    if (!productoId || productoId === "__vacio") {
      setValidacion("Selecciona el producto")
      return
    }
    if (!plantaId || plantaId === "__vacio") {
      setValidacion("Selecciona la planta")
      return
    }
    if (!Number.isFinite(valor) || valor === 0) {
      setValidacion("La cantidad no puede ser cero")
      return
    }
    if (tipo !== "ajuste" && valor < 0) {
      setValidacion("La cantidad de entrada o salida debe ser positiva")
      return
    }
    if (!motivo.trim()) {
      setValidacion("El motivo es obligatorio")
      return
    }
    setValidacion(null)
    void onGuardar({
      producto_id: productoId,
      planta_id: plantaId,
      tipo,
      cantidad: valor,
      motivo: motivo.trim(),
      referencia: referencia.trim(),
      fecha,
    })
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          reiniciar()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar movimiento de inventario</DialogTitle>
          <DialogDescription>
            Entrada, salida o ajuste de stock de un producto en una planta
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mov-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="mov-tipo" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_META[t]?.label ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-fecha">Fecha</Label>
            <Input
              id="mov-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-producto">Producto *</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger id="mov-producto" className="h-9 w-full">
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {activos.length === 0 && <SelectItem value="__vacio">Sin productos activos</SelectItem>}
                {activos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} · {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-planta">Planta *</Label>
            <Select value={plantaId} onValueChange={setPlantaId}>
              <SelectTrigger id="mov-planta" className="h-9 w-full">
                <SelectValue placeholder="Selecciona una planta" />
              </SelectTrigger>
              <SelectContent>
                {plantas.length === 0 && <SelectItem value="__vacio">Sin plantas</SelectItem>}
                {plantas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ?? "—"} · {p.nombre ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-cantidad">Cantidad *</Label>
            <Input
              id="mov-cantidad"
              type="number"
              min={tipo === "ajuste" ? undefined : "0"}
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder={tipo === "ajuste" ? "±0" : "0"}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              {tipo === "salida"
                ? "Se valida contra el stock disponible"
                : tipo === "ajuste"
                  ? "Ajuste al inventario físico"
                  : "Recepción de mercancía"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-referencia">Referencia</Label>
            <Input
              id="mov-referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="OP-2026-XXXX"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mov-motivo">Motivo *</Label>
            <Input
              id="mov-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Recepción de materia prima"
              className="h-9"
            />
          </div>
        </div>
        {(validacion || error) && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {validacion ?? error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              reiniciar()
            }}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DatosProducto {
  codigo: string
  nombre: string
  descripcion: string | null
  unidad: string
  activo: boolean
}

function DialogProducto({
  abierto,
  editando,
  onClose,
  guardando,
  error,
  onGuardar,
}: {
  abierto: boolean
  editando: ProductoApi | null
  onClose: () => void
  guardando: boolean
  error: string | null
  onGuardar: (datos: DatosProducto) => Promise<void>
}) {
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [unidad, setUnidad] = useState("t")
  const [activo, setActivo] = useState(true)
  const [validacion, setValidacion] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setCodigo(editando?.codigo ?? "")
      setNombre(editando?.nombre ?? "")
      setDescripcion(editando?.descripcion ?? "")
      setUnidad(editando?.unidad ?? "t")
      setActivo(editando?.activo ?? true)
      setValidacion(null)
    }
  }, [abierto, editando])

  const enviar = () => {
    if (!codigo.trim()) {
      setValidacion("El código es obligatorio")
      return
    }
    if (!nombre.trim()) {
      setValidacion("El nombre es obligatorio")
      return
    }
    setValidacion(null)
    void onGuardar({
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      unidad: unidad.trim() || "t",
      activo,
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Actualiza los datos del producto del catálogo"
              : "Agrega una referencia al catálogo de productos"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prd-codigo">Código *</Label>
            <Input
              id="prd-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="PAP-A4"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prd-unidad">Unidad</Label>
            <Input
              id="prd-unidad"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              placeholder="t"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prd-nombre">Nombre *</Label>
            <Input
              id="prd-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Papel A4 75 g"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prd-descripcion">Descripción</Label>
            <Input
              id="prd-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle opcional del producto"
              className="h-9"
            />
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Producto activo</span>
          </label>
        </div>
        {(validacion || error) && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {validacion ?? error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editando ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
