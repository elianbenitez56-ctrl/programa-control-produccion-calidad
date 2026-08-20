import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { Link } from "react-router-dom"

import { EstadoBadge, PanelChip, SidePanel } from "@/components/captura/SidePanel"
import { Stepper } from "@/components/captura/Stepper"
import { ChecklistStep } from "@/components/captura/steps/ChecklistStep"
import { OrdenStep } from "@/components/captura/steps/OrdenStep"
import { ParadasStep } from "@/components/captura/steps/ParadasStep"
import { ProduccionStep } from "@/components/captura/steps/ProduccionStep"
import { ResumenStep } from "@/components/captura/steps/ResumenStep"
import { StepShell } from "@/components/captura/steps/StepShell"
import { Button } from "@/components/ui/button"
import { capturaSteps } from "@/config/captura"
import { useAuth } from "@/contexts/AuthContext"
import { demoProductionOrders } from "@/data/demo"
import type {
  CapturaDraft,
  CapturaStep,
  ParadaRecord,
  ProduccionRecord,
} from "@/lib/captura"
import {
  capturaReady,
  clearDraft,
  computeTotals,
  emptyDraft,
  loadDraft,
  saveDraft,
} from "@/lib/captura"

export function CapturaProduccionPage() {
  const { user } = useAuth()

  const [step, setStep] = useState<CapturaStep>(1)
  const [draft, setDraft] = useState(() => loadDraft() ?? emptyDraft())
  const [recovered, setRecovered] = useState(() => loadDraft() !== null)
  const [finalizada, setFinalizada] = useState(false)
  const [finalOrder, setFinalOrder] = useState<{ id: string; producto: string } | null>(null)
  const [finalTotals, setFinalTotals] = useState<ReturnType<typeof computeTotals> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nowEpoch, setNowEpoch] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowEpoch(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (draft.ordenId || draft.produccion.length > 0 || draft.paradas.length > 0) {
      saveDraft(draft)
    }
  }, [draft])

  const orden = useMemo(
    () => demoProductionOrders.find((o) => o.id === draft.ordenId) ?? null,
    [draft.ordenId],
  )

  const totals = useMemo(
    () => computeTotals(draft, orden?.meta ?? 0, nowEpoch),
    [draft, orden, nowEpoch],
  )

  const completed = useMemo<CapturaStep[]>(() => {
    const list: CapturaStep[] = []
    if (draft.ordenId) list.push(1)
    const allChecked =
      Object.keys(draft.checklist).length > 0 &&
      Object.values(draft.checklist).every(Boolean)
    if (allChecked) list.push(2)
    if (draft.produccion.length > 0) list.push(3)
    if (draft.paradas.length > 0) list.push(4)
    return list
  }, [draft])

  function update(patch: Partial<CapturaDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function descartarBorrador() {
    clearDraft()
    setDraft(emptyDraft())
    setRecovered(false)
    setError(null)
    setStep(1)
  }

  function finalizar() {
    const validacion = capturaReady(draft)
    if (!validacion.ok) {
      setError(validacion.pendientes.join(" · "))
      return
    }
    setError(null)
    setFinalOrder(orden ? { id: orden.id, producto: orden.producto } : null)
    setFinalTotals(totals)
    setFinalizada(true)
    clearDraft()
  }

  function nuevaCaptura() {
    setDraft(emptyDraft())
    setRecovered(false)
    setFinalizada(false)
    setFinalOrder(null)
    setFinalTotals(null)
    setError(null)
    setStep(1)
  }

  if (finalizada && finalOrder && finalTotals) {
    return <SuccessScreen orden={finalOrder} totals={finalTotals} onNueva={nuevaCaptura} />
  }

  const canContinue = step === 1 ? Boolean(draft.ordenId) : true

  const stepTitles = capturaSteps.find((s) => s.n === step)

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/dashboard" className="transition-colors hover:text-foreground">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/produccion" className="transition-colors hover:text-foreground">
          Producción
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Captura de producción</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Captura de producción</h1>
          <p className="text-sm text-muted-foreground">
            Registro de turno para operarios · {user?.nombre} {user?.apellidos}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoBadge draft={draft} finalizada={finalizada} />
          <Button variant="outline" size="sm" onClick={descartarBorrador}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restablecer
          </Button>
        </div>
      </div>

      {recovered && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-chart-3/30 bg-chart-3/10 px-4 py-3 animate-fade-in">
          <Sparkles className="h-4 w-4 text-chart-3" />
          <p className="flex-1 text-sm text-chart-3">
            Borrador recuperado automáticamente. El progreso se guarda de forma continua.
          </p>
          <Button variant="ghost" size="sm" onClick={descartarBorrador} className="text-muted-foreground">
            Descartar borrador
          </Button>
        </div>
      )}

      <PanelChip draft={draft} orden={orden} totals={totals} finalizada={finalizada} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Stepper
            current={step}
            completed={completed}
            onSelect={(s) => {
              setError(null)
              setStep(s)
            }}
          />

          <StepShell
            step={step}
            title={stepTitles?.title ?? ""}
            subtitle={
              step === 1
                ? "Selecciona la orden y el sistema cargará los datos del turno"
                : step === 2
                  ? "Confirmación rápida antes de iniciar la producción"
                  : step === 3
                    ? "Se registra automáticamente la hora y la cantidad buena se calcula"
                    : step === 4
                      ? "El operario solo indica motivo; minutos y tiempo se calculan solos"
                      : "Revisa los indicadores y cierra el turno"
            }
            canContinue={canContinue}
            onBack={() => setStep((s) => Math.max(1, s - 1) as CapturaStep)}
            onNext={() => setStep((s) => Math.min(4, s + 1) as CapturaStep)}
            hideContinue={step === 5}
          >
            {step === 1 && (
              <OrdenStep
                ordenId={draft.ordenId}
                onChange={(ordenId) => {
                  update({ ordenId, inicioISO: draft.inicioISO ?? new Date().toISOString() })
                }}
              />
            )}
            {step === 2 && (
              <ChecklistStep
                checklist={draft.checklist}
                comentario={draft.comentarioPreparacion}
                onToggle={(key) =>
                  setDraft((prev) => ({
                    ...prev,
                    checklist: { ...prev.checklist, [key]: !prev.checklist[key] },
                  }))
                }
                onComentario={(value) => update({ comentarioPreparacion: value })}
              />
            )}
            {step === 3 && (
              <ProduccionStep
                registros={draft.produccion}
                unidad={orden?.unidad ?? "u"}
                onAdd={(record: ProduccionRecord) =>
                  setDraft((prev) => ({ ...prev, produccion: [...prev.produccion, record] }))
                }
                onRemove={(id) =>
                  setDraft((prev) => ({
                    ...prev,
                    produccion: prev.produccion.filter((r) => r.id !== id),
                  }))
                }
              />
            )}
            {step === 4 && (
              <ParadasStep
                paradas={draft.paradas}
                onAdd={(parada: ParadaRecord) =>
                  setDraft((prev) => ({ ...prev, paradas: [...prev.paradas, parada] }))
                }
                onRemove={(id) =>
                  setDraft((prev) => ({
                    ...prev,
                    paradas: prev.paradas.filter((p) => p.id !== id),
                  }))
                }
              />
            )}
            {step === 5 && (
              <ResumenStep
                draft={draft}
                orden={orden}
                totals={totals}
                error={error}
                onObservaciones={(value) => update({ observacionesFinales: value })}
                onFinalizar={finalizar}
              />
            )}
          </StepShell>
        </div>

        <aside className="xl:sticky xl:top-24 hidden lg:block">
          <SidePanel draft={draft} orden={orden} totals={totals} finalizada={finalizada} />
        </aside>
      </div>
    </div>
  )
}

function SuccessScreen({
  orden,
  totals,
  onNueva,
}: {
  orden: { id: string; producto: string }
  totals: ReturnType<typeof computeTotals>
  onNueva: () => void
}) {
  return (
    <div className="mx-auto max-w-xl animate-fade-up py-8">
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/15 text-chart-3">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Producción finalizada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La orden {orden.id} · {orden.producto} se cerró correctamente
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SuccessStat label="Producción" value={`${totals.produccionTotal.toFixed(1)} t`} />
          <SuccessStat label="Buenas" value={`${totals.buena.toFixed(1)} t`} />
          <SuccessStat label="Eficiencia" value={`${Math.round(totals.rendimiento * 100)}%`} />
          <SuccessStat label="OEE" value={`${Math.round(totals.oee * 100)}%`} />
        </div>

        <p className="mt-6 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          Demo local · Los datos de captura se persistirán en el backend cuando el módulo de
          producción esté conectado.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/produccion">Volver a Producción</Link>
          </Button>
          <Button onClick={onNueva}>Nueva captura</Button>
        </div>
      </div>
    </div>
  )
}

function SuccessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}