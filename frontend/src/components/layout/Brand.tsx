import { Hexagon } from "lucide-react"

import { cn } from "@/lib/utils"

interface BrandProps {
  collapsed?: boolean
  className?: string
  /** Sobre fondo oscuro (sidebar navy) */
  dark?: boolean
}

export function Brand({ collapsed, className, dark }: BrandProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#030b4f] to-[#005db6]">
        <Hexagon className="h-5 w-5 text-white" strokeWidth={2.2} />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p
            className={cn(
              "text-sm font-bold tracking-tight",
              dark ? "text-white" : "text-foreground",
            )}
          >
            INAPEL
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                dark ? "bg-white/15 text-white" : "bg-[#005db6]/15 text-[#00468b]",
              )}
            >
              MES
            </span>
          </p>
          <p
            className={cn(
              "text-[11px]",
              dark ? "text-sidebar-foreground/60" : "text-muted-foreground",
            )}
          >
            Control de Producción y Calidad
          </p>
        </div>
      )}
    </div>
  )
}