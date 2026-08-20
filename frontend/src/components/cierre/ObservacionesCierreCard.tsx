import { MessageSquareText } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface ObservacionesCierreCardProps {
  value: string
  onChange: (value: string) => void
}

export function ObservacionesCierreCard({ value, onChange }: ObservacionesCierreCardProps) {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-semibold">Observaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          id="cierre-observaciones"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Incidencias, recomendaciones o comentarios del turno (opcional)"
          className="min-h-28"
        />
      </CardContent>
    </Card>
  )
}