import { ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"

export interface CrumbItem {
  label: string
  to?: string
}

/** Breadcrumb de la navegación corporativa (Inicio › Planta › Sección › Máquina) */
export function NavigationBreadcrumb({ items }: { items: CrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
            {item.to && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : ""}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}