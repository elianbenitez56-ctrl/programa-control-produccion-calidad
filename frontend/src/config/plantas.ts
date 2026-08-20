import {
  Archive,
  BadgeCheck,
  BookOpen,
  Bookmark,
  Boxes,
  Droplet,
  Factory,
  Layers,
  Printer,
  Recycle,
  Scissors,
  ScrollText,
  Snowflake,
  Stamp,
  Warehouse,
  Wind,
  Workflow,
  type LucideIcon,
} from "lucide-react"

/**
 * Catálogo corporativo del sistema MES.
 * Estructura: Planta → Sección (proceso) → Máquina.
 * Es la fuente de verdad de la navegación corporativa (INAPEL / MARFIL).
 */

export interface Maquina {
  id: string
  /** Nombre visible de la máquina/equipo */
  nombre: string
  /** Descripción corta (opcional) */
  descripcion?: string
}

export interface SeccionProduccion {
  id: string
  nombre: string
  descripcion: string
  icon: LucideIcon
  /** Máquinas asociadas. Vacío = sección preparada sin equipos aún */
  maquinas: Maquina[]
}

export interface Planta {
  id: string
  nombre: string
  /** Razón social / nombre largo mostrado en la tarjeta */
  razonSocial: string
  descripcion: string
  icon: LucideIcon
  secciones: SeccionProduccion[]
}

export const plantas: Planta[] = [
  {
    id: "inapel",
    nombre: "INAPEL",
    razonSocial: "Industria Nacional Papelera",
    descripcion: "Producción de papel, empaques y acabados gráficos",
    icon: Factory,
    secciones: [
      {
        id: "litografia",
        nombre: "Litografía",
        descripcion: "Impresión offset de pliegos",
        icon: Printer,
        maquinas: [
          { id: "gto-46", nombre: "GTO 46", descripcion: "Offset 1 color" },
          { id: "gto-52", nombre: "GTO 52", descripcion: "Offset 2 colores" },
          { id: "sm-74", nombre: "SM 74", descripcion: "Offset 4 colores" },
          { id: "sm-102", nombre: "SM 102", descripcion: "Offset pliego" },
          { id: "roland-700", nombre: "Roland 700", descripcion: "Offset pliego" },
          { id: "tp-miller", nombre: "TP Miller", descripcion: "Offset perfecting" },
          { id: "uv-miller", nombre: "UV Miller", descripcion: "Offset con curado UV" },
        ],
      },
      {
        id: "troquelado",
        nombre: "Troquelado",
        descripcion: "Corte y troquelado de piezas",
        icon: Scissors,
        maquinas: [
          { id: "troqueladora-1", nombre: "Troqueladora 1", descripcion: "Troquel plano" },
          { id: "troqueladora-2", nombre: "Troqueladora 2", descripcion: "Troquel plano" },
          { id: "troqueladora-rot", nombre: "Troqueladora rotativa", descripcion: "Troquel rotativo" },
        ],
      },
      {
        id: "plastificado",
        nombre: "Plastificado",
        descripcion: "Laminado y plastificado de superficies",
        icon: Layers,
        maquinas: [
          { id: "plastificadora-1", nombre: "Plastificadora 1", descripcion: "Película mate" },
          { id: "plastificadora-2", nombre: "Plastificadora 2", descripcion: "Película brillante" },
        ],
      },
      {
        id: "acabados",
        nombre: "Acabados y Libros",
        descripcion: "Encuadernación, acabados y libros",
        icon: BookOpen,
        maquinas: [
          { id: "guillotina-1", nombre: "Guillotina 1", descripcion: "Corte de precisión" },
          { id: "encuadernadora", nombre: "Encuadernadora", descripcion: "Encuadernación" },
          { id: "planchadora", nombre: "Planchadora", descripcion: "Planchado / kirker" },
        ],
      },
      {
        id: "convertidoras",
        nombre: "Convertidoras",
        descripcion: "Conversión de papel y bobinas",
        icon: Workflow,
        maquinas: [
          { id: "chm-01", nombre: "CHM 01", descripcion: "Convertidora de papel" },
          { id: "maquigraf", nombre: "Maquigraf", descripcion: "Convertidora multilínea" },
        ],
      },
      {
        id: "flexografia",
        nombre: "Flexografía",
        descripcion: "Impresión flexográfica y rayado",
        icon: Stamp,
        maquinas: [
          { id: "rayadora-bielomatik", nombre: "Rayadora Bielomatik", descripcion: "Rayadora" },
          { id: "rayadora-will", nombre: "Rayadora Will", descripcion: "Rayadora" },
          { id: "rayadora-china-1", nombre: "Rayadora China 1", descripcion: "Rayadora" },
          { id: "rayadora-china-2", nombre: "Rayadora China 2", descripcion: "Rayadora" },
          { id: "rayadora-china-3", nombre: "Rayadora China 3", descripcion: "Rayadora" },
          { id: "rayadora-china-4", nombre: "Rayadora China 4", descripcion: "Rayadora" },
          { id: "finalizadora-1", nombre: "Finalizadora 1", descripcion: "Finalizadora" },
          { id: "finalizadora-2", nombre: "Finalizadora 2", descripcion: "Finalizadora" },
          { id: "finalizadora-will", nombre: "Finalizadora Will", descripcion: "Finalizadora" },
          { id: "grapadora", nombre: "Grapadora", descripcion: "Grapado de cuadernillos" },
          { id: "cosedoras", nombre: "Cosedoras", descripcion: "Cosido de cuadernillos" },
          { id: "despuntadoras", nombre: "Despuntadoras", descripcion: "Despunte de bloques" },
        ],
      },
      {
        id: "archivo",
        nombre: "Archivo",
        descripcion: "Archivo y resguardo de planchas",
        icon: Archive,
        maquinas: [
          { id: "archivo-central", nombre: "Archivo central", descripcion: "Resguardo de documentos" },
        ],
      },
      {
        id: "argollado",
        nombre: "Argollado",
        descripcion: "Encuadernación con argollas",
        icon: Bookmark,
        maquinas: [
          { id: "argolladora", nombre: "Argolladora", descripcion: "Encuadernado argollado" },
        ],
      },
      {
        id: "rollos-termicos",
        nombre: "Rollos Térmicos",
        descripcion: "Impresión y corte de rollos térmicos",
        icon: ScrollText,
        maquinas: [
          { id: "rebondeadora", nombre: "Rebondeadora", descripcion: "Rebobinado de rollos" },
          { id: "cortadora-rollos", nombre: "Cortadora de rollos", descripcion: "Corte de alta precisión" },
        ],
      },
      {
        id: "almacen",
        nombre: "Almacén",
        descripcion: "Bodega de producto terminado e insumos",
        icon: Warehouse,
        maquinas: [
          { id: "almacen-central", nombre: "Almacén central", descripcion: "Recepción y despacho" },
        ],
      },
      {
        id: "reciclaje",
        nombre: "Reciclaje",
        descripcion: "Corte, separación y recuperación de material",
        icon: Recycle,
        maquinas: [
          { id: "trituradora", nombre: "Trituradora", descripcion: "Recuperación de papel" },
        ],
      },
    ],
  },
  {
    id: "marfil",
    nombre: "MARFIL",
    razonSocial: "Planta de Plásticos",
    descripcion: "Inyección, soplado y ensamble de productos plásticos",
    icon: Boxes,
    secciones: [
      {
        id: "inyeccion",
        nombre: "Inyección",
        descripcion: "Moldeo por inyección de plástico",
        icon: Droplet,
        maquinas: [],
      },
      {
        id: "soplado",
        nombre: "Soplado",
        descripcion: "Moldeo por soplado",
        icon: Wind,
        maquinas: [],
      },
      {
        id: "cuarto-frio",
        nombre: "Cuarto Frío",
        descripcion: "Almacenamiento y curado en frío",
        icon: Snowflake,
        maquinas: [],
      },
      {
        id: "ensamble",
        nombre: "Ensamble",
        descripcion: "Líneas de ensamble de partes",
        icon: Boxes,
        maquinas: [],
      },
      {
        id: "calidad",
        nombre: "Calidad",
        descripcion: "Control de calidad de planta",
        icon: BadgeCheck,
        maquinas: [],
      },
      {
        id: "bodega",
        nombre: "Bodega",
        descripcion: "Almacén y despacho de producto",
        icon: Warehouse,
        maquinas: [],
      },
    ],
  },
]

export function getPlanta(plantaId: string | undefined): Planta | undefined {
  return plantas.find((p) => p.id === plantaId)
}

export function getSeccion(
  plantaId: string | undefined,
  seccionId: string | undefined,
): SeccionProduccion | undefined {
  return getPlanta(plantaId)?.secciones.find((s) => s.id === seccionId)
}

export function getMaquina(
  plantaId: string | undefined,
  seccionId: string | undefined,
  maquinaId: string | undefined,
): Maquina | undefined {
  return getSeccion(plantaId, seccionId)?.maquinas.find((m) => m.id === maquinaId)
}

/** Ruta base del sistema MES de una máquina */
export function mesRutaBase(
  plantaId: string,
  seccionId: string,
  maquinaId: string,
): string {
  return `/mes/${plantaId}/${seccionId}/${maquinaId}`
}

export function rutaSeccion(plantaId: string, seccionId: string): string {
  return `/planta/${plantaId}/seccion/${seccionId}`
}