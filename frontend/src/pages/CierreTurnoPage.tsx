import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  FileDown,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react"
import { Link } from "react-router-dom"

import { InfoContextCard } from "@/components/cierre/InfoContextCard"
import { ObservacionesCierreCard } from "@/components/cierre/ObservacionesCierreCard"
import { ParadasCierreCard } from "@/components/cierre/ParadasCierreCard"
import { ProduccionCierreCard } from "@/components/cierre/ProduccionCierreCard"
import { ResumenCierre } from "@/components/cierre/ResumenCierre"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { demoTurnoCierre } from "@/data/demo"
import type { CierreDraft } from "@/lib/cierre"
import {
  cierreReady,
  clearCierre,
  computarCierre,
  emptyCierre,
  loadCierre,
  saveCierre,
} from "@/lib/cierre"
import { generateCierrePdf } from "@/lib/cierrePdf"
import { formatTime } from "@/lib/formatters"

export function CierreTurnoPage() {
  const { user } = useAuth()
  const contexto = demoTurnoCierre

  const [draft, setDraft] = useState<CierreDraft>(() => loadCierre() ?? emptyCierre())
  const [recovered, setRecovered] = useState(() => loadCierre() !== null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const [pdfFile, setPdfFile] = useState<string | null>(null)
  const [finalizado, setFinalizado] = useState(false)

  const totals = computarCierre(draft, contexto.horaInicio, contexto.horaFin)
  const operario = `${user?.nombre ?? "—"} ${user?.apellidos ?? ""}`.trim()

  useEffect(() => {
    if (!savedAt) return
    const t = setTimeout(() => setSavedAt(null), 4000)
    return () => clearTimeout(t)
  }, [savedAt])

  function guardarBorrador() {
    saveCierre(draft)
    setSavedAt(formatTime(new Date()))
    setError(null)
  }

  function restablecer() {
    clearCierre()
    setDraft(emptyCierre())
    setRecovered(false)
    setError(null)
  }

  async function finalizar() {
    const validacion = cierreReady(draft)
    if (!validacion.ok) {
      setError(validacion.pendientes.join(" · "))
      return
    }
    setError(null)
    setGenerando(true)
    try {
      const fileName = await generateCierrePdf({
        contexto,
        draft,
        totals,
        operario,
      })
      setPdfFile(fileName)
      clearCierre()
      setDraft(emptyCierre())
      setFinalizado(true)
    } catch {
      setError("No se pudo generar el PDF. Intenta nuevamente.")
    } finally {
      setGenerando(false)
    }
  }

  function nuevoCierre() {
    setFinalizado(false)
    setPdfFile(null)
    setRecovered(false)
    setError(null)
  }

  if (finalizado) {
    return (
      <SuccessCierre
        orden={contexto.orden}
        pdfFile={pdfFile}
        onNuevo={nuevoCierre}
      />
    )
  }

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
        <span className="font-medium text-foreground">Cierre de turno</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierre de turno</h1>
          <p className="text-sm text-muted-foreground">
            Registro del resumen del turno · {operario} · se completa al finalizar el turno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={guardarBorrador}>
            <Save className="mr-2 h-4 w-4" />
            Guardar borrador
          </Button>
          <Button variant="ghost" onClick={restablecer}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restablecer
          </Button>
        </div>
      </div>

      {savedAt && (
        <div className="flex items-center gap-2 rounded-xl border border-chart-3/30 bg-chart-3/10 px-4 py-2.5 text-sm text-chart-3 animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          Borrador guardado automáticamente en este equipo ({savedAt})
        </div>
      )}

      {recovered && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-chart-3/30 bg-chart-3/10 px-4 py-3 animate-fade-in">
          <Sparkles className="h-4 w-4 text-chart-3" />
          <p className="flex-1 text-sm text-chart-3">
            Borrador del cierre recuperado. Puedes continuar donde quedaste.
          </p>
          <Button variant="ghost" size="sm" onClick={restablecer} className="text-muted-foreground">
            Descartar borrador
          </Button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <InfoContextCard contexto={contexto} />

          <ProduccionCierreCard
            total={draft.produccionTotal}
            buena={draft.buena}
            rechazada={draft.rechazada}
            unidad="t"
            onChange={(valores) => {
              setDraft((prev) => ({ ...prev, ...valores }))
              setError(null)
            }}
          />

          <ParadasCierreCard
            paradas={draft.paradas}
            onChange={(paradas) => {
              setDraft((prev) => ({ ...prev, paradas }))
              setError(null)
            }}
          />

          <ObservacionesCierreCard
            value={draft.observaciones}
            onChange={(observaciones) => setDraft((prev) => ({ ...prev, observaciones }))}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Finaliza tu turno</p>
              <p className="text-xs text-muted-foreground">
                Al finalizar se generará el PDF del formato oficial para archivo y auditoría
              </p>
            </div>
            <Button size="lg" onClick={finalizar} disabled={generando} className="sm:min-w-56">
              {generando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF…
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Finalizar turno
                </>
              )}
            </Button>
          </div>
        </div>

        <aside className="xl:sticky xl:top-24 hidden lg:block">
          <ResumenCierre totals={totals} />
        </aside>
      </div>
    </div>
  )
}

function SuccessCierre({
  orden,
  pdfFile,
  onNuevo,
}: {
  orden: string
  pdfFile: string | null
  onNuevo: () => void
}) {
  return (
    <div className="mx-auto max-w-xl animate-fade-up py-8">
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/15 text-chart-3">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Turno finalizado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El cierre de la orden {orden} se registró correctamente
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border bg-muted/30 px-4 py-4">
          <FileDown className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">PDF generado</p>
            <p className="break-all text-xs text-muted-foreground">{pdfFile ?? "formato oficial"}</p>
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          El documento incluye los datos del turno, producción, tiempos improductivos,
          observaciones y firmas, listo para archivo o auditoría.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/produccion">Volver a Producción</Link>
          </Button>
          <Button onClick={onNuevo}>Nuevo cierre de turno</Button>
        </div>
      </div>
    </div>
  )
}