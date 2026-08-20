import { useEffect, useRef, useState } from "react"
import { Eraser, PenLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SignaturePadProps {
  value: string | null
  onChange: (dataUrl: string | null) => void
  label: string
  required?: boolean
  height?: number
}

/**
 * Firma digital sobre canvas (mouse y táctil).
 * Exporta la firma como PNG data URL; null si está vacío.
 */
export function SignaturePad({ value, onChange, label, required, height = 128 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const hasInkRef = useRef(false)
  const [filled, setFilled] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#1e293b"
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, width, height)
      img.src = value
    }
  }, [value])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.1, p.y + 0.1)
    ctx.stroke()
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hasInkRef.current) {
      hasInkRef.current = true
      setFilled(true)
    }
  }

  function onUp() {
    drawingRef.current = false
    if (hasInkRef.current) {
      onChange(canvasRef.current?.toDataURL("image/png") ?? null)
    }
  }

  function limpiar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    ctx.scale(ratio, ratio)
    hasInkRef.current = false
    setFilled(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <PenLine className="h-3.5 w-3.5 text-primary" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limpiar}
          disabled={!filled}
          className="h-8 px-2 text-xs"
        >
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Limpiar
        </Button>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-dashed bg-white transition-colors",
          filled ? "border-chart-3/60" : "border-border hover:border-primary/40",
        )}
      >
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {!filled && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-muted-foreground/70">
            Firme aquí con el mouse o el dedo
          </p>
        )}
      </div>
    </div>
  )
}