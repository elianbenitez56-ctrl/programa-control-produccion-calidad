import { NavLink } from "react-router-dom"

import { mesModules, mesModuleRuta } from "@/config/mes"
import { cn } from "@/lib/utils"

interface MesModuleNavProps {
  base: string
}

/** Navegación de módulos del sistema MES de una máquina */
export function MesModuleNav({ base }: MesModuleNavProps) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border bg-card p-1.5 shadow-card">
      {mesModules.map((m) => {
        const Icon = m.icon
        const to = mesModuleRuta(base, m.segment)
        return (
          <NavLink
            key={m.key}
            to={to}
            end={m.segment === ""}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {m.label}
          </NavLink>
        )
      })}
    </nav>
  )
}