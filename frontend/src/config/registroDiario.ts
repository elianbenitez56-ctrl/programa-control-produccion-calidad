import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckSquare,
  ClipboardCheck,
  Clock3,
  FileText,
  Info,
  Settings2,
  Signature,
  type LucideIcon,
} from "lucide-react"

export type RegistroDiarioStep =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10

export interface RegistroDiarioStepDef {
  n: RegistroDiarioStep
  label: string
  title: string
  icon: LucideIcon
}

export const registroDiarioSteps: RegistroDiarioStepDef[] = [
  { n: 1, label: "Información", title: "Información general", icon: Info },
  { n: 2, label: "Producción", title: "Producción del turno", icon: Boxes },
  { n: 3, label: "Materia Prima", title: "Consumo de materia prima", icon: Settings2 },
  { n: 4, label: "Calidad", title: "Chequeo de calidad del área", icon: BadgeCheck },
  { n: 5, label: "Paradas", title: "Paradas del turno", icon: Clock3 },
  { n: 6, label: "Defectos", title: "Defectos encontrados", icon: AlertTriangle },
  { n: 7, label: "Incidencias", title: "Incidencias del turno", icon: Settings2 },
  { n: 8, label: "Observaciones", title: "Observaciones del turno", icon: FileText },
  { n: 9, label: "Firmas", title: "Firmas de aprobación", icon: Signature },
  { n: 10, label: "Vista previa", title: "Vista previa y envío", icon: ClipboardCheck },
]

export interface ChecklistCalidadDef {
  key: string
  label: string
  icon: LucideIcon
}

/** Checklist genérico por defecto (si el área no tiene uno propio) */
export const checklistCalidadItems: ChecklistCalidadDef[] = [
  { key: "primera_pieza", label: "Primera pieza aprobada", icon: CheckSquare },
  { key: "calidad_conforme", label: "Calidad conforme", icon: BadgeCheck },
  { key: "ajustes_realizados", label: "Ajustes realizados", icon: Settings2 },
  { key: "producto_limpio", label: "Producto limpio", icon: CheckSquare },
  { key: "empaque_correcto", label: "Empaque correcto", icon: Boxes },
  { key: "etiquetado_correcto", label: "Etiquetado correcto", icon: CheckSquare },
  { key: "maquina_limpia", label: "Máquina limpia", icon: Settings2 },
  { key: "area_limpia", label: "Área limpia", icon: CheckSquare },
]

/**
 * Checklists de calidad especializados por área de INAPEL.
 * Cada operario solo responde los puntos de su proceso.
 */
const checklistsPorArea: Record<string, ChecklistCalidadDef[]> = {
  litografia: [
    { key: "registro_correcto", label: "Registro correcto", icon: CheckSquare },
    { key: "color_correcto", label: "Color correcto", icon: BadgeCheck },
    { key: "sin_manchas", label: "Sin manchas", icon: CheckSquare },
    { key: "sin_rayas", label: "Sin rayas", icon: CheckSquare },
    { key: "registro_aprobado", label: "Registro aprobado", icon: BadgeCheck },
    { key: "tinta_uniforme", label: "Tinta uniforme", icon: Settings2 },
    { key: "papel_correcto", label: "Papel correcto", icon: Boxes },
    { key: "humedad_correcta", label: "Humedad correcta", icon: Settings2 },
  ],
  convertidoras: [
    { key: "corte_correcto", label: "Corte correcto", icon: CheckSquare },
    { key: "medidas_correctas", label: "Medidas correctas", icon: Boxes },
    { key: "escuadra_correcta", label: "Escuadra correcta", icon: CheckSquare },
    { key: "sin_rebabas", label: "Sin rebabas", icon: CheckSquare },
    { key: "empaque_correcto", label: "Empaque correcto", icon: Boxes },
  ],
  flexografia: [
    { key: "rayado_correcto", label: "Rayado correcto", icon: CheckSquare },
    { key: "centrado", label: "Centrado", icon: CheckSquare },
    { key: "pegado_correcto", label: "Pegado correcto", icon: BadgeCheck },
    { key: "grapado_correcto", label: "Grapado correcto", icon: BadgeCheck },
    { key: "numeracion_correcta", label: "Numeración correcta", icon: CheckSquare },
  ],
  archivo: [
    { key: "remaches_correctos", label: "Remaches correctos", icon: CheckSquare },
    { key: "esquinas_correctas", label: "Esquinas correctas", icon: CheckSquare },
    { key: "pasta_correcta", label: "Pasta correcta", icon: Boxes },
    { key: "acabado_correcto", label: "Acabado correcto", icon: BadgeCheck },
  ],
  troquelado: [
    { key: "corte_correcto", label: "Corte correcto", icon: CheckSquare },
    { key: "medidas_correctas", label: "Medidas correctas", icon: Boxes },
    { key: "piezas_completas", label: "Piezas completas", icon: CheckSquare },
    { key: "sin_rebabas", label: "Sin rebabas", icon: CheckSquare },
    { key: "apilado_correcto", label: "Apilado correcto", icon: Boxes },
  ],
  plastificado: [
    { key: "capa_adherida", label: "Película adherida", icon: BadgeCheck },
    { key: "sin_burbujas", label: "Sin burbujas", icon: CheckSquare },
    { key: "sin_arrugas", label: "Sin arrugas", icon: CheckSquare },
    { key: "brillo_uniforme", label: "Brillo uniforme", icon: BadgeCheck },
    { key: "bordes_sanos", label: "Bordes en buen estado", icon: CheckSquare },
  ],
  acabados: [
    { key: "guillotina_correcta", label: "Guillotinado correcto", icon: CheckSquare },
    { key: "encuadernado_correcto", label: "Encuadernado correcto", icon: BadgeCheck },
    { key: "planchado_correcto", label: "Planchado correcto", icon: BadgeCheck },
    { key: "sin_huellas", label: "Sin huellas", icon: CheckSquare },
    { key: "empaque_correcto", label: "Empaque correcto", icon: Boxes },
  ],
  argollado: [
    { key: "argollas_correctas", label: "Argollas correctas", icon: CheckSquare },
    { key: "cierre_correcto", label: "Cierre correcto", icon: BadgeCheck },
    { key: "hojas_centradas", label: "Hojas centradas", icon: CheckSquare },
    { key: "orificios_sin_dano", label: "Orificios sin daño", icon: CheckSquare },
  ],
  "rollos-termicos": [
    { key: "corte_correcto", label: "Corte correcto", icon: CheckSquare },
    { key: "diametro_correcto", label: "Diámetro correcto", icon: Boxes },
    { key: "sin_rebabas", label: "Sin rebabas", icon: CheckSquare },
    { key: "nucleo_correcto", label: "Núcleo correcto", icon: Boxes },
    { key: "etiquetado_correcto", label: "Etiquetado correcto", icon: CheckSquare },
  ],
  almacen: [
    { key: "empaque_correcto", label: "Empaque correcto", icon: Boxes },
    { key: "etiquetado_correcto", label: "Etiquetado correcto", icon: CheckSquare },
    { key: "cantidad_correcta", label: "Cantidad correcta", icon: Boxes },
    { key: "ubicacion_correcta", label: "Ubicación correcta", icon: CheckSquare },
  ],
  reciclaje: [
    { key: "trituracion_correcta", label: "Trituración correcta", icon: Settings2 },
    { key: "clasificacion_correcta", label: "Clasificación correcta", icon: Boxes },
    { key: "sin_contaminados", label: "Sin contaminantes", icon: BadgeCheck },
  ],
}

/** Checklist de calidad del área (fallback al genérico si el área no está catalogada) */
export function getChecklistParaArea(seccionId: string): ChecklistCalidadDef[] {
  return checklistsPorArea[seccionId] ?? checklistCalidadItems
}

/** Incidencias del turno según el estándar del operario */
export const incidenciasItems: string[] = [
  "Daño de máquina",
  "Falta de material",
  "Cambio de referencia",
  "Falla eléctrica",
  "Falla mecánica",
  "Falla neumática",
  "Ajuste de máquina",
  "Otro",
]

export const tiposDefecto: string[] = [
  "Dimensional",
  "Acabado superficial",
  "Material",
  "Etiquetado",
  "Sellado",
  "Tramado",
  "Otro",
]