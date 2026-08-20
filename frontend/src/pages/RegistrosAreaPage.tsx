import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileStack, Filter, ShieldCheck, Layers3, Trash2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { areaAsignada, esAccesoGlobal } from "@/config/usuarios"
import { api } from "@/lib/api"
import { getMaquina, plantas, type Planta } from "@/config/plantas"
import { pct } from "@/lib/registroDiario/compute"
import { generarPdfRegistroDiario } from "@/lib/registroDiario/pdf"
import type { RegistroDiarioCompleto } from "@/types/registroDiario"

/** Registro devuelto por GET /produccion/registros (backend) */
interface RegistroApi {
  id: string
  op_id: string
  fecha: string | null
  turno_id: string
  operario_id: string
  planta_id: string
  area_id: string
  maquina_id: string
  produccion_total: number
  produccion_buena: number
  produccion_rechazada: number
  unidad: string
  fecha_creacion: string | null
  planta_nombre?: string
  area_nombre?: string
  maquina_nombre?: string
  operario_nombre?: string
  turno_nombre?: string
  numero_op?: string
  producto?: string
  cliente?: string
}

/** Fila de la tabla de Registros por Área (referencias resueltas con nombres) */
interface RegistroArea {
  id: string
  folio: string
  creadoEn: string
  plantaNombre: string
  area: string
  maquina: string
  operario: string
  supervisor: string
  orden: string
  producto: string
  fecha: string
  turno: string
  produccionTotal: number
  produccionBuena: number
  oee: number
  /** Registro completo con datos de PDF; null para los de la API */
  pdf: RegistroDiarioCompleto | null
}

/** Convierte un registro del backend al modelo de la tabla */
function mapearRegistro(r: RegistroApi): RegistroArea {
  const total = r.produccion_total
  const buena = r.produccion_buena
  return {
    id: r.id,
    folio: `RD-${(r.fecha ?? "").replace(/-/g, "")}-${(r.numero_op ?? r.id).slice(0, 10)}`,
    creadoEn: r.fecha_creacion ?? "",
    plantaNombre: r.planta_nombre ?? r.planta_id,
    area: r.area_nombre ?? r.area_id,
    maquina: r.maquina_nombre ?? r.maquina_id,
    operario: r.operario_nombre ?? r.operario_id,
    supervisor: "",
    orden: r.numero_op ?? r.op_id,
    producto: r.producto ?? "",
    fecha: r.fecha ?? "",
    turno: r.turno_nombre ?? r.turno_id,
    produccionTotal: total,
    produccionBuena: buena,
    oee: total > 0 ? buena / total : 0,
    pdf: null,
  }
}

interface SupervisorCatalogo {
  id: string
  codigo: string | null
  nombre: string
  estado: string
  area: { id: string; codigo: string; nombre: string } | null
}

/** Etiqueta mostrada en el filtro: "1000 — ACUÑA ARIZA ROSIRIS ISABEL" */
function supervisorEtiqueta(s: SupervisorCatalogo): string {
  return s.codigo ? `${s.codigo} — ${s.nombre}` : s.nombre
}

/** Nombre puro del supervisor (sin el código) para comparar con los registros */
function supervisorNombre(opcion: string): string {
  return opcion.split(" — ").pop() ?? opcion
}

/**
 * Área oficial de supervisión de cada sección corporativa (Registros por Área).
 * El área es el nivel de supervisión del catálogo (FLEXOGRAFIA, LITOGRAFIA,
 * CONVERSION Y ARGOLLADO, LIBROS Y EDITORIALES). Las secciones que no
 * pertenecen a un área oficial se filtran por su propio nombre.
 */
const SECCION_A_AREA: Record<string, string> = {
  Litografía: "LITOGRAFIA",
  Flexografía: "FLEXOGRAFIA",
  Convertidoras: "CONVERSION Y ARGOLLADO",
  Argollado: "CONVERSION Y ARGOLLADO",
  "Acabados y Libros": "LIBROS Y EDITORIALES",
}

/** Área oficial de supervisión de una sección del catálogo (o la sección si no mapea) */
function areaDeSeccion(nombreSeccion: string): string {
  return SECCION_A_AREA[nombreSeccion] ?? nombreSeccion
}

/** Planta del catálogo corporativo (`config/plantas.ts`) por su nombre visible */
function catalogoPlantaPorNombre(nombre: string): Planta | undefined {
  return plantas.find((p) => p.nombre === nombre)
}

/** Áreas del catálogo corporativo de una planta (o de todas las plantas) */
function areasDelCatalogo(planta?: Planta): string[] {
  const lista = planta ? [planta] : plantas
  return Array.from(
    new Set(lista.flatMap((p) => p.secciones.map((s) => areaDeSeccion(s.nombre)))),
  ).sort()
}

/** Áreas resueltas en los registros, opcionalmente limitadas a una planta */
function areasEnRegistros(registros: RegistroArea[], plantaNombre?: string): string[] {
  return Array.from(
    new Set(
      registros
        .filter((r) => (plantaNombre ? r.plantaNombre === plantaNombre : true))
        .map((r) => r.area),
    ),
  ).sort()
}

/** Máquinas del catálogo corporativo que pertenecen a la (planta,) área indicada */
function maquinasDelCatalogo(area: string, planta?: Planta): string[] {
  const lista = planta ? [planta] : plantas
  return Array.from(
    new Set(
      lista.flatMap((p) =>
        p.secciones
          .filter((s) => areaDeSeccion(s.nombre) === area)
          .flatMap((s) => s.maquinas.map((m) => m.nombre)),
      ),
    ),
  ).sort()
}

/** Todas las máquinas del catálogo corporativo de una planta (o de todas) */
function maquinasCatalogoCompletas(planta?: Planta): string[] {
  const lista = planta ? [planta] : plantas
  return Array.from(
    new Set(lista.flatMap((p) => p.secciones.flatMap((s) => s.maquinas.map((m) => m.nombre)))),
  ).sort()
}

/** Máquinas presentes en los registros, opcionalmente de una planta/área */
function maquinasEnRegistros(
  registros: RegistroArea[],
  plantaNombre?: string,
  area?: string,
): string[] {
  return Array.from(
    new Set(
      registros
        .filter((r) => (plantaNombre ? r.plantaNombre === plantaNombre : true))
        .filter((r) => (area ? r.area === area : true))
        .map((r) => r.maquina),
    ),
  ).sort()
}

/**
 * Catálogo del selector MÁQUINA según la combinación PLANTA + ÁREA.
 * Con "todas" en ambos se conserva el comportamiento previo (máquinas de los
 * registros). Con planta/área concretas se cruza el catálogo corporativo con
 * las máquinas de los registros que pertenecen a la combinación, de modo que
 * nunca aparecen máquinas de otras áreas ni de otras plantas.
 */
function maquinasDePlantaArea(
  plantaNombre: string,
  area: string,
  registros: RegistroArea[],
): string[] {
  if (plantaNombre === "todas" && area === "todas") {
    return maquinasEnRegistros(registros)
  }
  const plantaCat = catalogoPlantaPorNombre(plantaNombre)
  if (area === "todas") {
    return Array.from(
      new Set([
        ...maquinasCatalogoCompletas(plantaCat),
        ...maquinasEnRegistros(registros, plantaNombre),
      ]),
    ).sort()
  }
  return Array.from(
    new Set([
      ...maquinasDelCatalogo(area, plantaCat),
      ...maquinasEnRegistros(registros, plantaNombre, area),
    ]),
  ).sort()
}

/**
 * Catálogo del selector ÁREA según la planta elegida: áreas del catálogo
 * corporativo de esa planta más las áreas resueltas en sus registros.
 * Con "todas" se combinan las áreas oficiales del catálogo de supervisores
 * y las de todos los registros (comportamiento previo).
 */
function areasDePlanta(
  plantaNombre: string,
  areasCatalogo: string[],
  registros: RegistroArea[],
): string[] {
  if (plantaNombre === "todas") {
    return Array.from(new Set([...areasCatalogo, ...areasEnRegistros(registros)])).sort()
  }
  return Array.from(
    new Set([
      ...areasDelCatalogo(catalogoPlantaPorNombre(plantaNombre)),
      ...areasEnRegistros(registros, plantaNombre),
    ]),
  ).sort()
}

interface Filtros {
  planta: string
  seccion: string
  maquina: string
  operario: string
  supervisor: string
  orden: string
  fecha: string
  turno: string
}

const FILTROS_VACIOS: Filtros = {
  planta: "todas",
  seccion: "todas",
  maquina: "todas",
  operario: "todos",
  supervisor: "todos",
  orden: "todas",
  fecha: "todas",
  turno: "todos",
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

export function RegistrosAreaPage() {
  const { user } = useAuth()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [generando, setGenerando] = useState<string | null>(null)
  const [supervisoresApi, setSupervisoresApi] = useState<SupervisorCatalogo[]>([])
  const [registros, setRegistros] = useState<RegistroArea[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [aEliminar, setAEliminar] = useState<RegistroArea | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const esAdmin = user?.roles?.includes("admin") ?? false

  /** Carga los registros reales de producción desde el backend */
  const cargarRegistros = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const r = await api.get<{ registros: RegistroApi[] }>("/produccion/registros")
      setRegistros(r.data.registros.map(mapearRegistro))
    } catch {
      setRegistros([])
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarRegistros()
  }, [cargarRegistros])

  /** Registros visibles según el rol (admin/supervisor: todos; operario: su máquina) */
  const registrosVisibles = useMemo(() => {
    if (!user) return []
    if (esAccesoGlobal(user)) return registros
    const asignacion = areaAsignada(user)
    const maquina = asignacion
      ? getMaquina(asignacion.plantaId, asignacion.seccionId, asignacion.maquinaId)?.nombre
      : undefined
    const operario = `${user.nombre} ${user.apellidos}`.trim()
    return registros.filter(
      (r) => (maquina && r.maquina === maquina) || r.operario === operario,
    )
  }, [registros, user])

  /** Elimina un registro de producción (solo admin) */
  const confirmarEliminar = useCallback(async () => {
    if (!aEliminar) return
    setBorrando(true)
    setErrorEliminar(null)
    try {
      await api.delete(`/produccion/registros/${aEliminar.id}`)
      setRegistros((prev) => prev.filter((r) => r.id !== aEliminar.id))
      setAEliminar(null)
    } catch {
      setErrorEliminar("No fue posible eliminar el registro. Intenta nuevamente.")
    } finally {
      setBorrando(false)
    }
  }, [aEliminar])

  /** Catálogo real de supervisores (usuarios con rol supervisor del backend) */
  useEffect(() => {
    let activo = true
    api
      .get<{ supervisores: SupervisorCatalogo[] }>("/usuarios/supervisores")
      .then((r) => {
        if (activo) setSupervisoresApi(r.data.supervisores)
      })
      .catch(() => {
        if (activo) setSupervisoresApi([])
      })
    return () => {
      activo = false
    }
  }, [])

  const opciones = useMemo(() => {
    const unicos = (sel: (r: RegistroArea) => string) =>
      Array.from(new Set(registrosVisibles.map(sel))).sort()
    /**
     * El filtro SUPERVISOR combina el catálogo real del sistema (usuarios con
     * rol supervisor, con su código) y los supervisores registrados en los
     * registros guardados (p. ej. "Administrador Sistema" en registros previos).
     */
    const supervisoresRegistrados = unicos((r) => r.supervisor).filter((s) => s !== "")
    const supervisores = Array.from(
      new Set([
        ...supervisoresApi.map(supervisorEtiqueta),
        ...supervisoresRegistrados,
      ]),
    ).sort()
    /**
     * El filtro ÁREA ofrece las áreas oficiales de supervisión (catálogo de
     * supervisores) y las áreas resueltas de los registros guardados.
     */
    const areasCatalogo = Array.from(
      new Set(
        supervisoresApi
          .map((s) => s.area?.nombre)
          .filter((n): n is string => Boolean(n)),
      ),
    )
    return {
      plantas: unicos((r) => r.plantaNombre),
      areas: areasDePlanta(filtros.planta, areasCatalogo, registrosVisibles),
      maquinas: maquinasDePlantaArea(filtros.planta, filtros.seccion, registrosVisibles),
      operarios: unicos((r) => r.operario),
      supervisores,
      ordenes: unicos((r) => r.orden),
      fechas: unicos((r) => r.fecha),
      turnos: unicos((r) => r.turno),
    }
  }, [registrosVisibles, supervisoresApi, filtros.planta, filtros.seccion])

  /** Área oficial del supervisor seleccionado en el filtro (si está catalogado) */
  const areaSupervisorSeleccionado = useMemo(
    () =>
      supervisoresApi.find((s) => supervisorEtiqueta(s) === filtros.supervisor)?.area
        ?.nombre ?? "",
    [supervisoresApi, filtros.supervisor],
  )

  const filtrados = useMemo(() => {
    return registrosVisibles
      .filter((r) => filtros.planta === "todas" || r.plantaNombre === filtros.planta)
      .filter((r) => filtros.seccion === "todas" || r.area === filtros.seccion)
      .filter((r) => filtros.maquina === "todas" || r.maquina === filtros.maquina)
      .filter((r) => filtros.operario === "todos" || r.operario === filtros.operario)
      .filter((r) => filtros.supervisor === "todos" || r.supervisor === supervisorNombre(filtros.supervisor))
      .filter((r) => filtros.orden === "todas" || r.orden === filtros.orden)
      .filter((r) => filtros.fecha === "todas" || r.fecha === filtros.fecha)
      .filter((r) => filtros.turno === "todos" || r.turno === filtros.turno)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  }, [registrosVisibles, filtros])

  const kpis = useMemo(() => {
    const total = filtrados.reduce((acc, r) => acc + r.produccionTotal, 0)
    const buena = filtrados.reduce((acc, r) => acc + r.produccionBuena, 0)
    const oee = filtrados.length
      ? filtrados.reduce((acc, r) => acc + r.oee, 0) / filtrados.length
      : 0
    return { total, buena, oee }
  }, [filtrados])

  const global = esAccesoGlobal(user)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
            <FileStack className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Registros por Área</h1>
            <p className="text-sm text-muted-foreground">
              Consulta consolidada de los reportes diarios de producción y calidad
            </p>
          </div>
        </div>
        {!global && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-chart-1/10 px-3 py-1 text-xs font-bold text-chart-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Visibilidad: mi área
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Layers3} label="Registros" valor={String(filtrados.length)} tone="text-chart-1 bg-chart-1/10 border-chart-1/20" />
        <Kpi icon={FileStack} label="Producción total" valor={kpis.total.toFixed(1)} tone="text-chart-2 bg-chart-2/10 border-chart-2/20" />
        <Kpi icon={ShieldCheck} label="Producción buena" valor={kpis.buena.toFixed(1)} tone="text-chart-3 bg-chart-3/10 border-chart-3/20" />
        <Kpi icon={Filter} label="OEE promedio" valor={`${pct(kpis.oee)}%`} tone="text-chart-4 bg-chart-4/10 border-chart-4/20" />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FiltroSelect
            label="Planta"
            value={filtros.planta}
            onChange={(v) => setFiltros({ ...FILTROS_VACIOS, planta: v })}
            opciones={opciones.plantas}
            valorTodas="todas"
          />
          <FiltroSelect
            label="Área"
            value={filtros.seccion}
            onChange={(v) =>
              setFiltros((f) => {
                const maquinasNuevas = maquinasDePlantaArea(f.planta, v, registrosVisibles)
                return {
                  ...f,
                  seccion: v,
                  maquina:
                    f.maquina !== "todas" && !maquinasNuevas.includes(f.maquina)
                      ? "todas"
                      : f.maquina,
                }
              })
            }
            opciones={opciones.areas}
            valorTodas="todas"
            disabled={Boolean(areaSupervisorSeleccionado)}
          />
          <FiltroSelect
            label="Máquina"
            value={filtros.maquina}
            onChange={(v) => setFiltros((f) => ({ ...f, maquina: v }))}
            opciones={opciones.maquinas}
            valorTodas="todas"
            pie={
              filtros.planta !== "todas" &&
              filtros.seccion !== "todas" &&
              opciones.maquinas.length === 0
                ? "No hay máquinas disponibles para esta área"
                : undefined
            }
          />
          <FiltroSelect
            label="Operario"
            value={filtros.operario}
            onChange={(v) => setFiltros((f) => ({ ...f, operario: v }))}
            opciones={opciones.operarios}
            valorTodas="todos"
          />
          <FiltroSelect
            label="Supervisor"
            value={filtros.supervisor}
            onChange={(v) =>
              setFiltros((f) => {
                const sup = supervisoresApi.find((s) => supervisorEtiqueta(s) === v)
                return {
                  ...f,
                  supervisor: v,
                  seccion: v === "todos" ? "todas" : (sup?.area?.nombre ?? f.seccion),
                }
              })
            }
            opciones={opciones.supervisores}
            valorTodas="todos"
          />
          <FiltroSelect
            label="Orden de producción"
            value={filtros.orden}
            onChange={(v) => setFiltros((f) => ({ ...f, orden: v }))}
            opciones={opciones.ordenes}
            valorTodas="todas"
          />
          <FiltroSelect
            label="Fecha"
            value={filtros.fecha}
            onChange={(v) => setFiltros((f) => ({ ...f, fecha: v }))}
            opciones={opciones.fechas}
            valorTodas="todas"
          />
          <FiltroSelect
            label="Turno"
            value={filtros.turno}
            onChange={(v) => setFiltros((f) => ({ ...f, turno: v }))}
            opciones={opciones.turnos}
            valorTodas="todos"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {cargando ? (
          <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
            Cargando registros…
          </div>
        ) : errorCarga ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <FileStack className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-semibold">No fue posible cargar los registros</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Intenta nuevamente en unos momentos.
            </p>
            <Button variant="outline" size="sm" onClick={() => void cargarRegistros()}>
              Reintentar
            </Button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileStack className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-sm font-semibold">Sin registros para mostrar</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {registrosVisibles.length === 0
                ? "Los registros diarios enviados desde el módulo Registro Diario aparecerán aquí. Ajuste los filtros o registre su primer reporte."
                : "Ajuste los filtros para ver los registros disponibles."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-3 py-3">Área · Máquina</th>
                  <th className="px-3 py-3">Operario</th>
                  <th className="px-3 py-3">Orden</th>
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3 text-right">Producida</th>
                  <th className="px-3 py-3 text-right">Buena</th>
                  <th className="px-3 py-3 text-right">OEE</th>
                  <th className="px-3 py-3">Fecha · Turno</th>
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold text-primary">{r.folio}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{r.area}</p>
                      <p className="text-xs text-muted-foreground">{r.maquina}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">{r.operario}</td>
                    <td className="px-3 py-3 text-xs">{r.orden}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-xs">{r.producto}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.produccionTotal.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-chart-3">{r.produccionBuena.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-primary">{pct(r.oee)}%</td>
                    <td className="px-3 py-3 text-xs">
                      {r.fecha}
                      <span className="block text-muted-foreground">{r.turno}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.pdf && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Descargar PDF"
                            onClick={() => {
                              if (!r.pdf) return
                              setGenerando(r.id)
                              void generarPdfRegistroDiario(r.pdf).finally(() => setGenerando(null))
                            }}
                            disabled={generando === r.id}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {esAdmin && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Eliminar registro"
                            onClick={() => {
                              setAEliminar(r)
                              setErrorEliminar(null)
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
)}
        </div>

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
            <DialogTitle>¿Eliminar registro?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede
              deshacer.
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
              {borrando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FiltroSelect({
  label,
  value,
  onChange,
  opciones,
  valorTodas,
  disabled = false,
  pie,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  opciones: string[]
  valorTodas: string
  disabled?: boolean
  pie?: string
}) {
  const todas = valorTodas === "todos" ? "Todos" : "Todas"
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={valorTodas}>{todas}</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pie ? <p className="mt-1 text-xs font-medium text-warning">{pie}</p> : null}
    </div>
  )
}