import { PenLine, ShieldCheck, UserCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { SignaturePad } from "@/components/registroDiario/SignaturePad"
import { cn } from "@/lib/utils"
import type { FirmasRegistro, FirmaCampo } from "@/types/registroDiario"

interface FirmasStepProps {
  firmas: FirmasRegistro
  onFirma: (campo: FirmaCampo, dataUrl: string) => void
}

const CAMPOS: { campo: FirmaCampo; titulo: string; nombre: string; icono: LucideIcon; obligatoria?: boolean }[] = [
  { campo: "operario", titulo: "Firma del operario", nombre: "Operario responsable", icono: UserCheck, obligatoria: true },
  { campo: "supervisor", titulo: "Firma del supervisor", nombre: "Supervisor de turno", icono: ShieldCheck, obligatoria: true },
  { campo: "inspectorCalidad", titulo: "Firma de inspección de calidad", nombre: "Inspector de calidad", icono: PenLine },
]

export function FirmasStep({ firmas, onFirma }: FirmasStepProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {CAMPOS.map(({ campo, titulo, nombre, icono: Icon, obligatoria }) => {
        const dataUrl = firmas[campo] ?? ""
        return (
          <div
            key={campo}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-4 shadow-sm",
              dataUrl ? "border-chart-3/40" : "border-border",
            )}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border",
                  dataUrl
                    ? "border-chart-3/30 bg-chart-3/10 text-chart-3"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {titulo}
                  {obligatoria && <span className="ml-1 text-destructive">*</span>}
                </p>
                <p className="text-xs text-muted-foreground">{nombre}</p>
              </div>
            </div>
            <SignaturePad
              value={dataUrl}
              onChange={(dataUrl) => onFirma(campo, dataUrl ?? "")}
              label={titulo}
              height={140}
            />
            {!dataUrl && (
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                Firmar con mouse o dedo sobre el recuadro.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}