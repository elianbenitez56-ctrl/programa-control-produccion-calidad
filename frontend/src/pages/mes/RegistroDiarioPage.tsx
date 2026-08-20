import { useEffect, useState } from "react"
import { CheckCircle2, ClipboardList, Download, FilePlus2, History, Layers3, Printer } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { CalidadStep } from "@/components/registroDiario/steps/CalidadStep"
import { DefectosStep } from "@/components/registroDiario/steps/DefectosStep"
import { FirmasStep } from "@/components/registroDiario/steps/FirmasStep"
import { IncidenciasStep } from "@/components/registroDiario/steps/IncidenciasStep"
import { InfoGeneralStep } from "@/components/registroDiario/steps/InfoGeneralStep"
import { MateriaPrimaStep } from "@/components/registroDiario/steps/MateriaPrimaStep"
import { ObservacionesStep } from "@/components/registroDiario/steps/ObservacionesStep"
import { ParadasStep } from "@/components/registroDiario/steps/ParadasStep"
import { ProduccionStep } from "@/components/registroDiario/steps/ProduccionStep"
import { VistaPreviaStep } from "@/components/registroDiario/steps/VistaPreviaStep"
import { ConsolidadoOrdenDialog } from "@/components/registroDiario/ConsolidadoOrdenDialog"
import { WizardStepShell } from "@/components/wizard/WizardStepShell"
import { WizardStepper } from "@/components/wizard/WizardStepper"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMaquina, getPlanta, getSeccion } from "@/config/plantas"
import { getChecklistParaArea, registroDiarioSteps, type RegistroDiarioStep } from "@/config/registroDiario"
import { areaAsignada } from "@/config/usuarios"
import { useAuth } from "@/contexts/AuthContext"
import { ordenesParaMaquina } from "@/data/registroDiarioDemo"
import { useRegistroDiario } from "@/hooks/useRegistroDiario"
import { generarPdfRegistroDiario } from "@/lib/registroDiario/pdf"
import { listarRegistros } from "@/services/registroDiarioService"
import type { RegistroDiarioCompleto } from "@/types/registroDiario"

export function RegistroDiarioPage() {
  const { plantaId, seccionId, maquinaId } = useParams()
  const { user } = useAuth()
  const [pendientes, setPendientes] = useState<string[]>([])
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [openHistorico, setOpenHistorico] = useState(false)

  const planta = getPlanta(plantaId)
  const seccion = getSeccion(plantaId, seccionId)
  const maquina = getMaquina(plantaId, seccionId, maquinaId)

  const operario = `${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim()
  const supervisor = areaAsignada(user)?.supervisor
  const checklistArea = getChecklistParaArea(seccionId ?? "")

  const registro = useRegistroDiario({
    plantaNombre: planta?.nombre ?? "",
    seccionNombre: seccion?.nombre ?? "",
    maquinaNombre: maquina?.nombre ?? "",
    operario,
    ordenId: null,
    supervisor,
    checklist: checklistArea,
  })

  if (!planta || !seccion || !maquina) {
    return <Navigate to="/inicio" replace />
  }

  const ordenes = ordenesParaMaquina(maquina.id)
  const total = registroDiarioSteps.length
  const pasoDef = registroDiarioSteps[registro.paso - 1]

  const completados = registroDiarioSteps
    .filter((s) => registro.pasoCompletado(s.n))
    .map((s) => s.n)

  const pasoOpcional = [5, 6, 7].includes(registro.paso)
  const canContinue = pasoOpcional || registro.pasoCompletado(registro.paso)

  function descargarPdf() {
    if (!registro.guardado) return
    setGenerandoPdf(true)
    void generarPdfRegistroDiario(registro.guardado).finally(() => setGenerandoPdf(false))
  }

  function handleFinalizar() {
    const validacion = registro.validar()
    if (!validacion.ok) {
      setPendientes(validacion.pendientes)
      return
    }
    setPendientes([])
    const nuevo = registro.finalizar()
    if (nuevo) {
      setGenerandoPdf(true)
      void generarPdfRegistroDiario(nuevo).finally(() => setGenerandoPdf(false))
    }
  }

  if (registro.guardado) {
    return (
      <PantallaExito
        registro={registro.guardado}
        onNuevo={registro.reiniciar}
        onDescargar={descargarPdf}
        generandoPdf={generandoPdf}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Registro Diario de Producción y Calidad</h1>
            <p className="text-sm text-muted-foreground">
              Área {seccion.nombre} · {maquina.nombre} · {planta.nombre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-chart-3/15 px-3 py-1 text-xs font-bold text-chart-3">
            {registro.avance}% completado
          </span>
          <Button variant="outline" size="sm" onClick={() => setOpenHistorico(true)}>
            <History className="mr-2 h-4 w-4" />
            Histórico
          </Button>
        </div>
      </div>

      <HistoricoDialog open={openHistorico} onOpenChange={setOpenHistorico} />

      <WizardStepper
        pasos={registroDiarioSteps.map((s) => ({ key: String(s.n), label: s.label, icon: s.icon }))}
        actual={registro.paso}
        completados={completados}
        onSelect={(n) => registro.setPaso(n as RegistroDiarioStep)}
      />

      <WizardStepShell
        key={registro.paso}
        paso={registro.paso}
        total={total}
        title={pasoDef.title}
        subtitle={pasoDef.label}
        canContinue={canContinue}
        onBack={registro.anterior}
        onNext={registro.siguiente}
        continueLabel={registro.paso === 9 ? "Revisar y confirmar" : "Continuar"}
        hideContinue={registro.paso === 10}
      >
        {registro.paso === 1 && (
          <InfoGeneralStep
            auto={registro.auto}
            ordenes={ordenes}
            onSelectOrden={registro.seleccionarOrden}
          />
        )}
        {registro.paso === 2 && (
          <ProduccionStep
            auto={registro.auto}
            produccion={registro.draft.produccion}
            onChange={registro.setProduccion}
          />
        )}
        {registro.paso === 3 && (
          <MateriaPrimaStep
            items={registro.draft.materiasPrima}
            seccionId={seccion.id}
            unidad={registro.auto.unidad}
            onChange={registro.setMateriasPrima}
          />
        )}
        {registro.paso === 4 && (
          <CalidadStep
            items={checklistArea}
            checklist={registro.draft.checklist}
            onToggle={registro.toggleChecklist}
          />
        )}
        {registro.paso === 5 && (
          <ParadasStep paradas={registro.draft.paradas} onChange={registro.setParadas} />
        )}
        {registro.paso === 6 && (
          <DefectosStep defectos={registro.draft.defectos} onChange={registro.setDefectos} />
        )}
        {registro.paso === 7 && (
          <IncidenciasStep
            marcadas={registro.draft.incidencias}
            otroTexto={registro.draft.incidenciaOtroTexto}
            onToggle={registro.toggleIncidencia}
            onChangeOtroTexto={registro.setOtroTexto}
          />
        )}
        {registro.paso === 8 && (
          <ObservacionesStep valor={registro.draft.observaciones} onChange={registro.setObservaciones} />
        )}
        {registro.paso === 9 && (
          <FirmasStep firmas={registro.draft.firmas} onFirma={registro.setFirma} />
        )}
        {registro.paso === 10 && (
          <div className="space-y-4">
            <VistaPreviaStep items={checklistArea} auto={registro.auto} draft={registro.draft} />
            {pendientes.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm font-semibold text-destructive">
                  No se puede enviar el registro:
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-destructive/90">
                  {pendientes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              onClick={handleFinalizar}
              disabled={generandoPdf}
              className="w-full min-w-[180px]"
            >
              {generandoPdf ? (
                "Generando PDF..."
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Finalizar y enviar registro
                </>
              )}
            </Button>
          </div>
        )}
      </WizardStepShell>
    </div>
  )
}

function PantallaExito({
  registro,
  onNuevo,
  onDescargar,
  generandoPdf,
}: {
  registro: RegistroDiarioCompleto
  onNuevo: () => void
  onDescargar: () => void
  generandoPdf: boolean
}) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/15 text-chart-3">
          <CheckCircle2 className="h-9 w-9" strokeWidth={1.75} />
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight">Registro enviado con éxito</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El registro diario quedó guardado y el PDF corporativo fue generado automáticamente.
        </p>

        <div className="mt-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Folio
          </span>
          <p className="mt-0.5 text-base font-bold tabular-nums text-primary">{registro.folio}</p>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={onDescargar} disabled={generandoPdf}>
            <Download className="mr-2 h-4 w-4" />
            {generandoPdf ? "Generando..." : "Descargar PDF"}
          </Button>
          <Button variant="outline" onClick={onNuevo}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Nuevo registro
          </Button>
        </div>
      </div>
    </div>
  )
}

function HistoricoDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [registros, setRegistros] = useState<RegistroDiarioCompleto[]>([])
  const [generando, setGenerando] = useState<string | null>(null)
  const [consolidadoOrden, setConsolidadoOrden] = useState<string | null>(null)

  useEffect(() => {
    if (open) setRegistros(listarRegistros().slice().reverse())
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registros diarios enviados</DialogTitle>
            <DialogDescription>
              Histórico local de registros finalizados ({registros.length} en total). Use
              "Consolidado" para ver todas las áreas de una orden.
            </DialogDescription>
          </DialogHeader>

          {registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <History className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-sm font-semibold">Aún no hay registros enviados</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Los registros finalizados aparecerán aquí con su folio y PDF descargable.
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {registros.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">{r.folio}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.autocompletado.seccionNombre} · {r.autocompletado.maquinaNombre} ·{" "}
                      {r.autocompletado.producto} · {r.autocompletado.fecha} (
                      {r.autocompletado.turno})
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-chart-2">
                      OEE {(r.autocompletado.oee * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConsolidadoOrden(r.autocompletado.ordenId)}
                      title="Consolidado de la orden de producción"
                    >
                      <Layers3 className="mr-2 h-4 w-4" />
                      Consolidado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGenerando(r.id)
                        void generarPdfRegistroDiario(r).finally(() => setGenerando(null))
                      }}
                      disabled={generando === r.id}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {generando === r.id ? "Generando..." : "PDF"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConsolidadoOrdenDialog
        open={Boolean(consolidadoOrden)}
        onOpenChange={(o) => !o && setConsolidadoOrden(null)}
        ordenId={consolidadoOrden ?? ""}
      />
    </>
  )
}