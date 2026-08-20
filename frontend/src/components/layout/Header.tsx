import { useMemo, useState } from "react"
import {
  Bell,
  CalendarDays,
  CheckCheck,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { Brand } from "@/components/layout/Brand"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useMes } from "@/contexts/MesContext"
import { useTheme } from "@/contexts/ThemeContext"
import { modules } from "@/config/modules"
import { plantas } from "@/config/plantas"
import { demoNotifications, demoRecentOrders } from "@/data/demo"
import { accentClasses } from "@/config/modules"
import { cn } from "@/lib/utils"
import { initialsOf, todayLong } from "@/lib/formatters"

const DATE_PRESETS = ["Hoy", "Ayer", "Esta semana", "Este mes"] as const

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { seleccion, setSeleccion } = useMes()
  const navigate = useNavigate()

  const [datePreset, setDatePreset] = useState<(typeof DATE_PRESETS)[number]>("Hoy")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const unread = useMemo(() => demoNotifications.filter((n) => !n.read).length, [])

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return []
    const fromModules = modules
      .filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term),
      )
      .map((m) => ({ label: m.name, sub: "Módulo", to: m.path, Icon: m.icon, accent: m.accent }))
    const fromOrders = demoRecentOrders
      .filter(
        (o) =>
          o.id.toLowerCase().includes(term) ||
          o.producto.toLowerCase().includes(term) ||
          o.maquina.toLowerCase().includes(term),
      )
      .map((o) => ({
        label: o.id,
        sub: `${o.producto} · ${o.maquina}`,
        to: "/produccion",
        Icon: Search,
        accent: "blue" as const,
      }))
    return [...fromModules, ...fromOrders].slice(0, 8)
  }, [searchTerm])

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md dark:bg-card/90 sm:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={onMenuClick} title="Abrir menú">
          <Menu className="h-5 w-5" />
        </Button>
        <Brand />
      </div>

      <div className="hidden flex-1 items-center lg:flex">
        <div className="relative w-full max-w-md">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar módulos, órdenes, productos…"
                  className="h-10 rounded-full border border-input bg-muted/60 pl-10 pr-14"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-2 sm:w-96"
            >
              {searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {searchTerm.trim()
                    ? "Sin resultados para «" + searchTerm + "»"
                    : "Escribe para buscar en el sistema"}
                </p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchOpen(false)
                        setSearchTerm("")
                        navigate(r.to)
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          accentClasses(r.accent),
                        )}
                      >
                        <r.Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.sub}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <span className="hidden items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground xl:flex">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="capitalize">{todayLong()}</span>
        </span>

        <Select
          value={seleccion.plantaId ?? undefined}
          onValueChange={(value) => {
            setSeleccion({ plantaId: value, seccionId: null, maquinaId: null })
            navigate(`/planta/${value}`)
          }}
        >
          <SelectTrigger className="hidden h-10 w-auto gap-2 px-3 md:flex">
            <span className="text-muted-foreground">Planta:</span>
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            {plantas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-chart-3" />
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="hidden h-10 lg:inline-flex">
              <CalendarDays className="mr-2 h-4 w-4" />
              {datePreset}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Periodo
            </p>
            <div className="grid gap-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDatePreset(p)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                    datePreset === p && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  {p}
                  {datePreset === p && <Badge variant="secondary">seleccionado</Badge>}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Cambiar tema">
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" title="Notificaciones">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-5 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-5" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold">Notificaciones</p>
                <p className="text-xs text-muted-foreground">{unread} sin leer</p>
              </div>
              <Button variant="ghost" size="sm">
                <CheckCheck className="mr-2 h-4 w-4" />
                Leer todas
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {demoNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b border-border/50 p-4 transition-colors hover:bg-accent/50",
                    !n.read && "bg-accent/30",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      accentClasses(n.accent),
                    )}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {n.title}
                      {!n.read && <Badge className="h-1.5 w-1.5 rounded-full bg-chart-5 p-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full">
                Ver todas las notificaciones
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 rounded-full px-1.5 py-1.5"
              >
                <Avatar className="h-9 w-9 ring-2 ring-primary/30">
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {initialsOf(`${user.nombre} ${user.apellidos}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-sm font-semibold">
                    {user.nombre} {user.apellidos}
                  </p>
                  <p className="text-[11px] text-muted-foreground">@{user.usuario}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-chart-3" />
                Administrador del sistema
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/configuracion">
                  <UserRound className="mr-2 h-4 w-4" />
                  Mi perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/configuracion">
                  <Settings className="mr-2 h-4 w-4" />
                  Preferencias
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}