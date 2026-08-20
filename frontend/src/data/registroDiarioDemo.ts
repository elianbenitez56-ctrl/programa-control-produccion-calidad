import { demoProductionOrders } from "@/data/demo"

/**
 * Datos de referencia del Registro Diario para la vista demo.
 * Son placeholders locales; se reemplazarán por las APIs del backend.
 */

/**
 * Vínculo órdenes ↔ máquina real.
 *
 * `demoProductionOrders` (data/demo.ts) indexa sus órdenes con códigos genéricos
 * ("MAQ-01"…"MAQ-04") que NO existen en el catálogo real de `config/plantas.ts`
 * ("sm-74", "chm-01", …). Por eso filtrar `o.maquina === maquinaId` siempre
 * devolvía una lista vacía y el Select de "Orden de producción" salía vacío.
 *
 * La fuente de verdad del puesto es el catálogo (`config/plantas.ts`): aquí se
 * asocian las órdenes demo a las máquinas reales que corresponden al proceso.
 * Cuando el módulo se conecte a las APIs del backend, esta tabla se reemplaza
 * por la consulta de órdenes planificadas de la máquina.
 */
const demoOrdersPorMaquinaId: Record<string, string[]> = {
  // INAPEL · Convertidoras
  "chm-01": ["OP-2026-0842", "OP-2026-0839"],
  maquigraf: ["OP-2026-0841", "OP-2026-0838"],
  // INAPEL · Litografía
  "sm-74": ["OP-2026-0840"],
}

/** Órdenes de producción disponibles para la máquina (por id del catálogo) */
export function ordenesParaMaquina(maquinaId: string) {
  const ids = demoOrdersPorMaquinaId[maquinaId]
  if (!ids) return []
  return demoProductionOrders.filter((o) => ids.includes(o.id))
}

/** Materias primas sugeridas (referenciales) por sección */
const materiasPorSeccion: Record<string, string[]> = {
  convertidoras: ["Bobina kraft 120g", "Adhesivo hotmelt", "Film PE"],
  litografia: ["Papel couché 115g", "Tinta offset", "Barniz UV"],
  flexografia: ["Papel bond 75g", "Tinta flexográfica", "Cera"],
  troquelado: ["Cartón dúplex", "Plancha troquelada"],
  plastificado: ["Película BOPP mate", "Película BOPP brillante"],
  acabados: ["Papel interior", "Cola blanca", "Lámina de cubierta"],
  archivo: ["Carpetas A4", "Cajas de archivo"],
  argollado: ["Argolla metálica", "Cartulina portada"],
  "rollos-termicos": ["Papel térmico 80mm", "Papel térmico 57mm"],
  almacen: ["Cajas de cartón", "Stretch film"],
  reciclaje: ["Retales de papel"],
  inyeccion: ["Resina PP", "Masterbatch"],
  soplado: ["Resina HDPE"],
  "cuarto-frio": [],
  ensamble: ["Kit de componentes"],
  calidad: [],
  bodega: [],
}

export function materiasSugeridasPara(seccionId: string): string[] {
  return materiasPorSeccion[seccionId] ?? []
}