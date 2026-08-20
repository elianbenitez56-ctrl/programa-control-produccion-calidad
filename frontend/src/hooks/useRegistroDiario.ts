import { useEffect, useMemo, useRef, useState } from "react"

import {
  registroDiarioSteps,
  type ChecklistCalidadDef,
  type RegistroDiarioStep,
} from "@/config/registroDiario"
import { loadCierre } from "@/lib/cierre"
import {
  autocompletarRegistro,
  resolverRegistro,
  type AutocompletarParams,
} from "@/lib/registroDiario/compute"
import {
  clearBorrador,
  loadBorrador,
  nuevoFolio,
  registrarRegistro,
  saveBorrador,
} from "@/services/registroDiarioService"
import type {
  DefectoItem,
  FirmaCampo,
  MateriaPrimaItem,
  ParadaRegistroItem,
  ProduccionRegistro,
  RegistroDiarioCompleto,
  RegistroDiarioDraft,
  ValidacionRegistro,
} from "@/types/registroDiario"

export interface UseRegistroDiarioParams extends AutocompletarParams {
  /** Checklist de calidad del área (getChecklistParaArea) */
  checklist: ChecklistCalidadDef[]
  /** Supervisor asignado al operario (config/usuarios) */
  supervisor?: string
}

export function borradorVacio(): RegistroDiarioDraft {
  return {
    ordenId: null,
    produccion: {
      referencia: "",
      programada: 0,
      producida: 0,
      buena: 0,
      rechazada: 0,
      reprocesada: 0,
      horaInicio: "",
      horaFin: "",
    },
    paradas: [],
    checklist: {},
    materiasPrima: [],
    defectos: [],
    incidencias: [],
    incidenciaOtroTexto: "",
    observaciones: "",
    firmas: { operario: null, supervisor: null, inspectorCalidad: null },
    inicioISO: new Date().toISOString(),
  }
}

/** Pasos que cuentan para el avance (la vista previa no suma) */
const PASOS_AVANCE: RegistroDiarioStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function useRegistroDiario(params: UseRegistroDiarioParams) {
  const [paso, setPaso] = useState<RegistroDiarioStep>(1)
  const [draft, setDraft] = useState<RegistroDiarioDraft>(() => loadBorrador() ?? borradorVacio())
  const [guardado, setGuardado] = useState<RegistroDiarioCompleto | null>(null)
  const ordenRef = useRef<string | null>(loadBorrador()?.ordenId ?? null)

  /** Base autocompletada (orden, turno, contexto) */
  const base = useMemo(
    () =>
      autocompletarRegistro({
        ...params,
        ordenId: draft.ordenId,
        supervisor: params.supervisor,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.plantaNombre, params.seccionNombre, params.maquinaNombre, params.operario, params.supervisor, draft.ordenId],
  )

  /** Registro resuelto: lo que el operario registró combinado con la base */
  const auto = useMemo(
    () => resolverRegistro(base, draft.produccion, draft.paradas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, draft.produccion, draft.paradas],
  )

  /* PREFILL POR ORDEN: al seleccionar/cambiar la orden se cargan los valores
     del sistema (orden/cierre/turno) como base editable y las paradas del
     cierre de turno. El operario ajusta solo lo de su proceso. */
  useEffect(() => {
    if (ordenRef.current === draft.ordenId) return
    ordenRef.current = draft.ordenId
    if (!draft.ordenId) return
    const paradas: ParadaRegistroItem[] =
      loadCierre()?.paradas.map((p) => ({
        id: p.id || `par-${Math.random().toString(36).slice(2, 8)}`,
        inicio: p.inicio,
        fin: p.fin,
        motivo: p.motivo,
        observacion: p.observacion,
      })) ?? []
    setDraft((d) => ({
      ...d,
      produccion: {
        referencia: base.referencia,
        programada: base.meta,
        producida: base.produccionTotal,
        buena: base.produccionBuena,
        rechazada: base.produccionMala,
        reprocesada: 0,
        horaInicio: base.horaInicio,
        horaFin: base.horaFin,
      },
      paradas,
      checklist: {},
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ordenId, base])

  useEffect(() => {
    const t = setTimeout(() => saveBorrador(draft), 400)
    return () => clearTimeout(t)
  }, [draft])

  const pasoCompletado = (n: RegistroDiarioStep): boolean => {
    switch (n) {
      case 1:
        return Boolean(draft.ordenId)
      case 2:
        return (
          draft.produccion.programada > 0 &&
          draft.produccion.producida > 0 &&
          draft.produccion.buena > 0 &&
          Boolean(draft.produccion.horaInicio) &&
          Boolean(draft.produccion.horaFin)
        )
      case 3:
        return (
          draft.materiasPrima.length > 0 &&
          draft.materiasPrima.every((m) => m.material.trim() !== "")
        )
      case 4:
        return params.checklist.every((i) => draft.checklist[i.key])
      case 5:
      case 6:
      case 7:
        return true
      case 8:
        return draft.observaciones.trim().length > 0
      case 9:
        return Boolean(draft.firmas.operario && draft.firmas.supervisor)
      case 10:
        return true
    }
  }

  const completados = useMemo(
    () => PASOS_AVANCE.filter((n) => pasoCompletado(n)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, params.checklist],
  )
  const avance = Math.round((completados / PASOS_AVANCE.length) * 100)

  function validar(): ValidacionRegistro {
    const pendientes: string[] = []
    if (!draft.ordenId) pendientes.push("Seleccionar la orden de producción (paso 1).")
    if (!pasoCompletado(2))
      pendientes.push(
        "Completar la producción del turno: programada, producida, buena y horario (paso 2).",
      )
    if (!pasoCompletado(3)) pendientes.push("Registrar al menos una materia prima con nombre (paso 3).")
    if (!pasoCompletado(4)) pendientes.push("Completar el chequeo de calidad del área (paso 4).")
    if (!pasoCompletado(8)) pendientes.push("Redactar las observaciones del turno (paso 8).")
    if (!pasoCompletado(9)) pendientes.push("Firmar operario y supervisor (paso 9).")
    return { ok: pendientes.length === 0, pendientes }
  }

  function irAPaso(n: RegistroDiarioStep) {
    setPaso(n)
  }

  function siguiente() {
    if (paso < 10) setPaso((paso + 1) as RegistroDiarioStep)
  }

  function anterior() {
    if (paso > 1) setPaso((paso - 1) as RegistroDiarioStep)
  }

  function seleccionarOrden(ordenId: string) {
    setDraft((d) => ({ ...d, ordenId }))
  }

  function setProduccion(produccion: ProduccionRegistro) {
    setDraft((d) => ({ ...d, produccion }))
  }

  function setParadas(paradas: ParadaRegistroItem[]) {
    setDraft((d) => ({ ...d, paradas }))
  }

  function toggleChecklist(key: string) {
    setDraft((d) => ({ ...d, checklist: { ...d.checklist, [key]: !d.checklist[key] } }))
  }

  function setMateriasPrima(items: MateriaPrimaItem[]) {
    setDraft((d) => ({ ...d, materiasPrima: items }))
  }

  function setDefectos(items: DefectoItem[]) {
    setDraft((d) => ({ ...d, defectos: items }))
  }

  function toggleIncidencia(label: string) {
    setDraft((d) => {
      const incidencias = d.incidencias.includes(label)
        ? d.incidencias.filter((i) => i !== label)
        : [...d.incidencias, label]
      const incidenciaOtroTexto =
        label === "Otro" && !incidencias.includes("Otro") ? "" : d.incidenciaOtroTexto
      return { ...d, incidencias, incidenciaOtroTexto }
    })
  }

  function setOtroTexto(texto: string) {
    setDraft((d) => ({ ...d, incidenciaOtroTexto: texto }))
  }

  function setObservaciones(valor: string) {
    setDraft((d) => ({ ...d, observaciones: valor }))
  }

  function setFirma(campo: FirmaCampo, dataUrl: string) {
    setDraft((d) => ({ ...d, firmas: { ...d.firmas, [campo]: dataUrl || null } }))
  }

  function finalizar(): RegistroDiarioCompleto | null {
    const validacion = validar()
    if (!validacion.ok) return null
    const registro: RegistroDiarioCompleto = {
      id: `${Date.now()}`,
      folio: nuevoFolio(draft.ordenId ?? "SIN-ORDEN"),
      creadoEn: new Date().toISOString(),
      pdfFileName: null,
      autocompletado: auto,
      draft,
    }
    registrarRegistro(registro)
    clearBorrador()
    setGuardado(registro)
    return registro
  }

  function reiniciar() {
    ordenRef.current = null
    setDraft(borradorVacio())
    setPaso(1)
    setGuardado(null)
  }

  return {
    paso,
    setPaso: irAPaso,
    draft,
    auto,
    avance,
    completados,
    pasoCompletado,
    validar,
    siguiente,
    anterior,
    seleccionarOrden,
    setProduccion,
    setParadas,
    toggleChecklist,
    setMateriasPrima,
    setDefectos,
    toggleIncidencia,
    setOtroTexto,
    setObservaciones,
    setFirma,
    finalizar,
    guardado,
    reiniciar,
  }
}

export { registroDiarioSteps }
