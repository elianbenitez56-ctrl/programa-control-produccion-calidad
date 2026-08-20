import * as React from "react"

import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

export function ChartCard({
  title,
  subtitle,
  action,
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex-1 p-4", contentClassName)}>{children}</div>
    </div>
  )
}