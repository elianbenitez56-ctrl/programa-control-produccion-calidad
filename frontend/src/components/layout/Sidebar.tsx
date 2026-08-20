import { ChevronLeft, ChevronRight } from "lucide-react"
import { NavLink } from "react-router-dom"

import { Brand } from "@/components/layout/Brand"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { navSectionsPara } from "@/lib/permisos"
import { cn } from "@/lib/utils"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth()
  const sections = navSectionsPara(user)

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out lg:flex",
        collapsed ? "w-[80px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/15 px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <Brand collapsed={collapsed} dark />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const link = (
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={cn(
                          "group relative flex items-center rounded-lg font-bold transition-all duration-200",
                          collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5",
                          isActive
                            ? "border-r-2 border-info bg-white/[0.12] text-white"
                            : "text-sidebar-foreground/60 hover:bg-white/[0.06] hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            !collapsed && isActive && "text-white",
                          )}
                          strokeWidth={1.75}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate text-[13px]">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <span className="rounded-full bg-chart-3/20 px-2 py-0.5 text-[10px] font-bold text-chart-3">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                )
                return collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-sidebar-foreground/60 hover:bg-white/[0.06] hover:text-sidebar-foreground",
            collapsed && "px-0",
          )}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="mr-2 h-4 w-4" />}
          {!collapsed && "Colapsar"}
        </Button>
      </div>
    </aside>
  )
}