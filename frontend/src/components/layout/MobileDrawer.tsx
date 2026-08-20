import { X } from "lucide-react"
import { NavLink } from "react-router-dom"

import { Brand } from "@/components/layout/Brand"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { navSectionsPara } from "@/lib/permisos"
import { cn } from "@/lib/utils"

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { user } = useAuth()
  const sections = navSectionsPara(user)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-card-hover animate-slide-in-right">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Brand dark />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-bold transition-colors",
                          isActive
                            ? "border-r-4 border-sidebar-foreground/80 bg-white/10 text-sidebar-foreground"
                            : "text-sidebar-foreground/60 hover:bg-white/[0.06] hover:text-sidebar-foreground",
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}