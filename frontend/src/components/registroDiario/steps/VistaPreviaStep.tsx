import { CheckCircle2, FileText } from "lucide-react"

import type { ChecklistCalidadDef } from "@/config/registroDiario"
import { formatMinutes } from "@/lib/captura"
import { cn } from "@/lib/utils"
import type { RegistroAutocompletado, RegistroDiarioDraft } from "@/types/registroDiario"

interface VistaPreviaStepProps {
  items: ChecklistCalidadDef[]
  auto: RegistroAutocompletado
  draft: RegistroDiarioDraft
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-primary">{titulo}</p>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function Fila({ label, value, ok = true }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-semibold", ok ? "text-foreground" : "text-destructive")}>
        {value}
      </span>
    </div>
  )
}

function Firma({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-chart-3">
          <CheckCircle2 className="h-3.5 w-3.5" /> Firmada
        </span>
      ) : (
        <span className="text-xs font-bold text-destructive">Pendiente</span>
      )}
    </div>
  )
}

export function VistaPreviaStep({ items, auto, draft }: VistaPreviaStepProps) {
  const checklistOk = items.every((i) => draft.checklist[i.key])
  const materiasOk = draft.materiasPrima.length > 0 && draft.materiasPrima.every((m) => m.material.trim() !== "")
  const observacionesOk = draft.observaciones.trim().length > 0
  const numIncidencias = draft.incidencias.length + (draft.incidenciaOtroTexto.trim() ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-chart-3/30 bg-chart-3/10 px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-chart-3" />
        <p className="text-xs font-medium text-chart-3">
          Revise el resumen del registro diario antes de confirmar el envío.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Datos generales">
          <Fila label="Planta" value={auto.plantaNombre} />
          <Fila label="Sección" value={auto.seccionNombre} />
          <Fila label="Máquina" value={auto.maquinaNombre} />
          <Fila label="Orden" value={auto.ordenId || "—"} ok={Boolean(auto.ordenId)} />
          <Fila label="Operario" value={auto.operario} />
          <Fila label="Supervisor" value={auto.supervisor} />
          <Fila label="Fecha / Turno" value={`${auto.fecha} · ${auto.turno}`} />
        </Seccion>

        <Seccion titulo="Producción del turno">
          <Fila label="Producción buena" value={`${auto.produccionBuena.toFixed(1)} ${auto.unidad}`} />
          <Fila label="Producción mala" value={`${auto.produccionMala.toFixed(1)} ${auto.unidad}`} />
          <Fila label="Reprocesada" value={`${draft.produccion.reprocesada.toFixed(1)} ${auto.unidad}`} />
          <Fila label="Cantidad programada" value={`${auto.meta.toFixed(1)} ${auto.unidad}`} />
          <Fila label="Tiempo productivo" value={formatMinutes(auto.tiempoProductivoMin)} />
          <Fila label="OEE" value={`${auto.oee.toFixed(1)}%`} />
          <Fila label="Calidad" value={`${auto.calidad.toFixed(1)}%`} />
        </Seccion>

        <Seccion titulo="Calidad e incidencias">
          <Fila
            label="Checklist de calidad"
            value={`${items.filter((i) => draft.checklist[i.key]).length}/${items.length} verificados`}
            ok={checklistOk}
          />
          <Fila
            label="Materias primas"
            value={`${draft.materiasPrima.length} registrada${draft.materiasPrima.length === 1 ? "" : "s"}`}
            ok={materiasOk}
          />
          <Fila label="Defectos" value={`${draft.defectos.length} registrado${draft.defectos.length === 1 ? "" : "s"}`} />
          <Fila label="Paradas" value={`${draft.paradas.length} registrada${draft.paradas.length === 1 ? "" : "s"}`} />
          <Fila label="Incidencias" value={`${numIncidencias} marcada${numIncidencias === 1 ? "" : "s"}`} />
        </Seccion>

        <Seccion titulo="Firmas">
          <Firma label="Operario" ok={Boolean(draft.firmas.operario)} />
          <Firma label="Supervisor" ok={Boolean(draft.firmas.supervisor)} />
          <Firma label="Inspector de calidad" ok={Boolean(draft.firmas.inspectorCalidad)} />
        </Seccion>
      </div>

      <Seccion titulo="Observaciones">
        <p className={cn("whitespace-pre-wrap", observacionesOk ? "text-foreground" : "text-destructive")}>
          {observacionesOk ? draft.observaciones : "Pendiente de redactar (obligatorio)."}
        </p>
      </Seccion>
    </div>
  )
}