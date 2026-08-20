// Datos de demostración visual para el diseño UI del frontend.
// IMPORTANTE: son placeholders locales; se reemplazarán por las respuestas
// reales de las APIs de cada módulo cuando se implementen en el backend.

export interface DemoKpi {
  key: string
  label: string
  value: string
  unit?: string
  trend: number
  trendUpIsGood: boolean
  spark: number[]
  accent: "blue" | "purple" | "green" | "amber" | "red"
}

export const demoKpis: DemoKpi[] = [
  { key: "ordenes", label: "Órdenes activas", value: "24", trend: 12.5, trendUpIsGood: true, spark: [18, 20, 19, 22, 21, 23, 24], accent: "blue" },
  { key: "produccion", label: "Producción del día", value: "48.6", unit: "t", trend: 8.2, trendUpIsGood: true, spark: [30, 35, 33, 38, 36, 44, 48.6], accent: "green" },
  { key: "inspecciones", label: "Inspecciones hoy", value: "156", trend: 4.1, trendUpIsGood: true, spark: [120, 128, 122, 135, 131, 149, 156], accent: "purple" },
  { key: "nc", label: "No conformidades", value: "7", trend: -22.0, trendUpIsGood: false, spark: [12, 11, 9, 10, 8, 9, 7], accent: "red" },
  { key: "oee", label: "OEE", value: "84.3", unit: "%", trend: 2.4, trendUpIsGood: true, spark: [78, 80, 79, 82, 81, 83, 84.3], accent: "blue" },
  { key: "disponibilidad", label: "Disponibilidad", value: "92.1", unit: "%", trend: 0.8, trendUpIsGood: true, spark: [90, 91, 90, 91.5, 92, 91.8, 92.1], accent: "green" },
  { key: "calidad", label: "Calidad", value: "97.4", unit: "%", trend: 0.5, trendUpIsGood: true, spark: [96.8, 97, 96.9, 97.2, 97.1, 97.3, 97.4], accent: "purple" },
  { key: "performance", label: "Performance", value: "93.8", unit: "%", trend: -0.6, trendUpIsGood: true, spark: [95, 94.5, 94.8, 94, 93.9, 94.2, 93.8], accent: "amber" },
]

export interface DemoProductionVsPlanPoint {
  day: string
  produccion: number
  plan: number
}

export const demoProductionVsPlan: DemoProductionVsPlanPoint[] = [
  { day: "Lun", produccion: 42.1, plan: 40 },
  { day: "Mar", produccion: 44.6, plan: 43 },
  { day: "Mié", produccion: 39.8, plan: 42 },
  { day: "Jue", produccion: 46.2, plan: 44 },
  { day: "Vie", produccion: 48.9, plan: 45 },
  { day: "Sáb", produccion: 35.4, plan: 38 },
  { day: "Dom", produccion: 30.1, plan: 32 },
]

export interface DemoOeePoint {
  day: string
  oee: number
  meta: number
}

export const demoOeeSeries: DemoOeePoint[] = [
  { day: "Lun", oee: 78.2, meta: 80 },
  { day: "Mar", oee: 80.4, meta: 80 },
  { day: "Mié", oee: 79.1, meta: 80 },
  { day: "Jue", oee: 82.7, meta: 80 },
  { day: "Vie", oee: 84.3, meta: 80 },
  { day: "Sáb", oee: 76.8, meta: 80 },
  { day: "Dom", oee: 74.2, meta: 80 },
]

export interface DemoSlice {
  name: string
  value: number
}

export const demoOrdersByStatus: DemoSlice[] = [
  { name: "En proceso", value: 12 },
  { name: "Programada", value: 7 },
  { name: "Finalizada", value: 4 },
  { name: "Pausada", value: 1 },
]

export const demoNcByType: DemoSlice[] = [
  { name: "Dimensional", value: 3 },
  { name: "Acabado superficial", value: 2 },
  { name: "Material", value: 1 },
  { name: "Etiquetado", value: 1 },
]

export interface DemoMachinePoint {
  maquina: string
  toneladas: number
}

export const demoProductionByMachine: DemoMachinePoint[] = [
  { maquina: "MAQ-01", toneladas: 12.4 },
  { maquina: "MAQ-02", toneladas: 10.8 },
  { maquina: "MAQ-03", toneladas: 9.6 },
  { maquina: "MAQ-04", toneladas: 8.9 },
  { maquina: "MAQ-05", toneladas: 6.9 },
]

export interface DemoOperatorPoint {
  operario: string
  turnos: number
}

export const demoProductionByOperator: DemoOperatorPoint[] = [
  { operario: "J. Ramírez", turnos: 18 },
  { operario: "L. Soto", turnos: 16 },
  { operario: "M. Herrera", turnos: 14 },
  { operario: "A. Vega", turnos: 12 },
  { operario: "P. Díaz", turnos: 9 },
]

export interface DemoWeeklyTrendPoint {
  fecha: string
  produccion: number
  calidad: number
}

export const demoWeeklyTrend: DemoWeeklyTrendPoint[] = [
  { fecha: "14 Jul", produccion: 41.2, calidad: 96.8 },
  { fecha: "15 Jul", produccion: 43.5, calidad: 97.0 },
  { fecha: "16 Jul", produccion: 42.8, calidad: 96.9 },
  { fecha: "17 Jul", produccion: 45.1, calidad: 97.2 },
  { fecha: "18 Jul", produccion: 46.7, calidad: 97.4 },
  { fecha: "19 Jul", produccion: 44.3, calidad: 97.1 },
  { fecha: "20 Jul", produccion: 47.9, calidad: 97.4 },
]

export interface DemoActivityEvent {
  id: string
  type: "orden" | "inspeccion" | "no_conformidad" | "reporte" | "sistema"
  title: string
  description: string
  time: string
}

export const demoActivity: DemoActivityEvent[] = [
  { id: "1", type: "orden", title: "Nueva orden creada", description: "OP-2026-0842 creada para la máquina MAQ-01", time: "hace 12 min" },
  { id: "2", type: "inspeccion", title: "Inspección realizada", description: "Insp. INSP-2026-0512 aprobada en línea 2", time: "hace 34 min" },
  { id: "3", type: "orden", title: "Orden finalizada", description: "OP-2026-0837 completada: 4.2 t en MAQ-03", time: "hace 1 h" },
  { id: "4", type: "no_conformidad", title: "No conformidad registrada", description: "NC-2026-0079: acabado superficial en MAQ-02", time: "hace 2 h" },
  { id: "5", type: "reporte", title: "Reporte generado", description: "Reporte de producción diario exportado a Excel", time: "hace 3 h" },
  { id: "6", type: "sistema", title: "Cambio de configuración", description: "Turno vespertino actualizado por administrador", time: "hace 5 h" },
]

export interface DemoOrder {
  id: string
  producto: string
  maquina: string
  cantidad: number
  unidad: string
  estado: "En proceso" | "Programada" | "Finalizada" | "Pausada"
  avance: number
  inicio: string
}

export const demoRecentOrders: DemoOrder[] = [
  { id: "OP-2026-0842", producto: "Papel kraft 120g", maquina: "MAQ-01", cantidad: 12, unidad: "t", estado: "En proceso", avance: 62, inicio: "05:40" },
  { id: "OP-2026-0841", producto: "Film PE 50 micras", maquina: "MAQ-02", cantidad: 8, unidad: "t", estado: "En proceso", avance: 45, inicio: "07:15" },
  { id: "OP-2026-0840", producto: "Cartón corrugado", maquina: "MAQ-03", cantidad: 10, unidad: "t", estado: "Programada", avance: 0, inicio: "12:30" },
  { id: "OP-2026-0839", producto: "Papel bond 75g", maquina: "MAQ-04", cantidad: 6, unidad: "t", estado: "Finalizada", avance: 100, inicio: "23:50" },
  { id: "OP-2026-0838", producto: "Film PET térmico", maquina: "MAQ-02", cantidad: 5, unidad: "t", estado: "Pausada", avance: 28, inicio: "04:10" },
]

export interface DemoNotification {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  accent: "blue" | "purple" | "green" | "amber" | "red"
}

export const demoNotifications: DemoNotification[] = [
  { id: "1", title: "No conformidad crítica", description: "NC-2026-0079 requiere atención del supervisor", time: "hace 2 h", read: false, accent: "red" },
  { id: "2", title: "Meta de OEE alcanzada", description: "MAQ-01 superó 85% OEE en turno actual", time: "hace 3 h", read: false, accent: "green" },
  { id: "3", title: "Programación actualizada", description: "Turno de la tarde reasignado a MAQ-03", time: "hace 5 h", read: false, accent: "blue" },
  { id: "4", title: "Reporte listo", description: "Reporte semanal de calidad disponible", time: "hace 1 día", read: true, accent: "purple" },
]

export interface DemoPlant {
  id: string
  nombre: string
}

export const demoPlants: DemoPlant[] = [
  { id: "PLT-01", nombre: "Planta Principal" },
  { id: "PLT-02", nombre: "Planta Secundaria" },
]

export interface DemoProductionOrder {
  id: string
  producto: string
  cliente: string
  referencia: string
  proceso: string
  material: string
  maquina: string
  turno: string
  fecha: string
  meta: number
  unidad: string
  estado: string
}

export const demoProductionOrders: DemoProductionOrder[] = [
  {
    id: "OP-2026-0842",
    producto: "Papel kraft 120g",
    cliente: "Embalajes del Norte",
    referencia: "PK-120G-NAT",
    proceso: "Laminación y corte",
    material: "Bobina kraft 120g",
    maquina: "MAQ-01",
    turno: "Turno A (06:00–14:00)",
    fecha: "05 ago 2026",
    meta: 12,
    unidad: "t",
    estado: "En proceso",
  },
  {
    id: "OP-2026-0841",
    producto: "Film PE 50 micras",
    cliente: "Envases del Pacífico",
    referencia: "FP-050-TRA",
    proceso: "Extrusión",
    material: "Resina LDPE",
    maquina: "MAQ-02",
    turno: "Turno A (06:00–14:00)",
    fecha: "05 ago 2026",
    meta: 8,
    unidad: "t",
    estado: "En proceso",
  },
  {
    id: "OP-2026-0840",
    producto: "Cartón corrugado",
    cliente: "Cajas y Empaques SA",
    referencia: "CC-3P-1040",
    proceso: "Corrugado",
    material: "Papel liner y medio",
    maquina: "MAQ-03",
    turno: "Turno A (06:00–14:00)",
    fecha: "05 ago 2026",
    meta: 10,
    unidad: "t",
    estado: "Programada",
  },
  {
    id: "OP-2026-0839",
    producto: "Papel bond 75g",
    cliente: "Papelera Industrial",
    referencia: "PB-075-BLK",
    proceso: "Conversión",
    material: "Papel bond 75g",
    maquina: "MAQ-04",
    turno: "Turno B (14:00–22:00)",
    fecha: "05 ago 2026",
    meta: 6,
    unidad: "t",
    estado: "Finalizada",
  },
  {
    id: "OP-2026-0838",
    producto: "Film PET térmico",
    cliente: "Envases del Pacífico",
    referencia: "FP-THM-038",
    proceso: "Laminación",
    material: "Film PET + adhesivo",
    maquina: "MAQ-02",
    turno: "Turno C (22:00–06:00)",
    fecha: "04 ago 2026",
    meta: 5,
    unidad: "t",
    estado: "En proceso",
  },
]

export interface DemoTurnoCierreContext {
  orden: string
  campana: string
  producto: string
  referencia: string
  cliente: string
  maquina: string
  linea: string
  proceso: string
  turno: string
  fecha: string
  horaInicio: string
  horaFin: string
  supervisor: string
}

export const demoTurnoCierre: DemoTurnoCierreContext = {
  orden: "OP-2026-0842",
  campana: "CMP-2026-14",
  producto: "Papel kraft 120g",
  referencia: "PK-120G-NAT",
  cliente: "Embalajes del Norte",
  maquina: "MAQ-01",
  linea: "L2",
  proceso: "Laminación y corte",
  turno: "Turno A (06:00–14:00)",
  fecha: "05 ago 2026",
  horaInicio: "06:00",
  horaFin: "14:00",
  supervisor: "J. Torres",
}

export interface DemoModuleRow {
  [key: string]: string | number
}

export const demoModuleTables: Record<string, DemoModuleRow[]> = {
  produccion: [
    { orden: "OP-2026-0842", producto: "Papel kraft 120g", maquina: "MAQ-01", turno: "A", cantidad: 12, unidad: "t", estado: "En proceso" },
    { orden: "OP-2026-0841", producto: "Film PE 50 micras", maquina: "MAQ-02", turno: "B", cantidad: 8, unidad: "t", estado: "En proceso" },
    { orden: "OP-2026-0840", producto: "Cartón corrugado", maquina: "MAQ-03", turno: "A", cantidad: 10, unidad: "t", estado: "Programada" },
    { orden: "OP-2026-0839", producto: "Papel bond 75g", maquina: "MAQ-04", turno: "B", cantidad: 6, unidad: "t", estado: "Finalizada" },
    { orden: "OP-2026-0838", producto: "Film PET térmico", maquina: "MAQ-02", turno: "C", cantidad: 5, unidad: "t", estado: "Pausada" },
  ],
  calidad: [
    { inspeccion: "INSP-2026-0512", producto: "Papel kraft 120g", tipo: "Proceso", resultado: "Aprobado", inspector: "J. Ramírez", fecha: "20 Jul 2026" },
    { inspeccion: "INSP-2026-0511", producto: "Film PE 50 micras", tipo: "Liberación", resultado: "Aprobado", inspector: "L. Soto", fecha: "20 Jul 2026" },
    { inspeccion: "INSP-2026-0510", producto: "Cartón corrugado", tipo: "Proceso", resultado: "En revisión", inspector: "M. Herrera", fecha: "19 Jul 2026" },
    { inspeccion: "INSP-2026-0509", producto: "Papel bond 75g", tipo: "Liberación", resultado: "Rechazado", inspector: "A. Vega", fecha: "19 Jul 2026" },
  ],
  trazabilidad: [
    { lote: "LOT-26-0784", producto: "Papel kraft 120g", orden: "OP-2026-0842", origen: "Bobina madre B-411", cantidad: 4.2, unidad: "t" },
    { lote: "LOT-26-0783", producto: "Film PE 50 micras", orden: "OP-2026-0841", origen: "Bobina madre B-409", cantidad: 3.6, unidad: "t" },
    { lote: "LOT-26-0782", producto: "Cartón corrugado", orden: "OP-2026-0840", origen: "N/A", cantidad: 2.1, unidad: "t" },
  ],
  inventario: [
    { material: "Bobina kraft 120g", ubicacion: "ALM-A-01", existencias: 24.8, unidad: "t", minimo: 10, estado: "Disponible" },
    { material: "Film PE 50 micras", ubicacion: "ALM-A-04", existencias: 12.3, unidad: "t", minimo: 8, estado: "Disponible" },
    { material: "Pigmento azul", ubicacion: "ALM-B-02", existencias: 0.4, unidad: "t", minimo: 1, estado: "Bajo mínimo" },
  ],
  reportes: [
    { nombre: "Producción diaria", modulo: "Producción", formato: "Excel", generado: "20 Jul 2026", usuario: "admin" },
    { nombre: "Calidad semanal", modulo: "Calidad", formato: "PDF", generado: "19 Jul 2026", usuario: "admin" },
    { nombre: "OEE mensual", modulo: "Indicadores", formato: "PDF", generado: "18 Jul 2026", usuario: "admin" },
  ],
  indicadores: [
    { maquina: "MAQ-01", oee: 86.4, disponibilidad: 94.2, rendimiento: 93.1, calidad: 98.5 },
    { maquina: "MAQ-02", oee: 83.1, disponibilidad: 91.8, rendimiento: 92.4, calidad: 97.6 },
    { maquina: "MAQ-03", oee: 79.8, disponibilidad: 88.9, rendimiento: 91.2, calidad: 98.1 },
    { maquina: "MAQ-04", oee: 74.5, disponibilidad: 85.3, rendimiento: 88.7, calidad: 96.9 },
  ],
  usuarios: [
    { usuario: "admin", nombre: "Administrador", rol: "admin", estado: "Activo", ultimo_acceso: "20 Jul 2026" },
    { usuario: "operario1", nombre: "Operario Demo", rol: "operario", estado: "Activo", ultimo_acceso: "20 Jul 2026" },
    { usuario: "sup.diaz", nombre: "P. Díaz", rol: "supervisor", estado: "Activo", ultimo_acceso: "19 Jul 2026" },
    { usuario: "cal.soto", nombre: "L. Soto", rol: "calidad", estado: "Inactivo", ultimo_acceso: "15 Jul 2026" },
  ],
  auditoria: [
    { evento: "Inicio de sesión", usuario: "admin", entidad: "SesionAutenticacion", fecha: "20 Jul 2026 08:12" },
    { evento: "Creación de orden", usuario: "admin", entidad: "OrdenProduccion", fecha: "20 Jul 2026 07:45" },
    { evento: "Actualización de turno", usuario: "admin", entidad: "Turno", fecha: "20 Jul 2026 06:30" },
    { evento: "Login kiosko", usuario: "operario1", entidad: "SesionOperario", fecha: "20 Jul 2026 05:40" },
  ],
}
