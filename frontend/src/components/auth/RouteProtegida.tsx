import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"
import { tieneAlgunPermiso, tenerAlgunRol } from "@/lib/permisos"
import type { Usuario } from "@/types/auth"

interface RouteProtegidaProps {
  /** Roles permitidos (basta uno). */
  roles?: string[]
  /** Permisos `recurso:accion` permitidos (basta uno). */
  permisos?: string[]
  /** Validación adicional (ej. operario solo su máquina). */
  validar?: (user: Usuario, params: Record<string, string | undefined>) => boolean
}

export function RouteProtegida({ roles, permisos, validar }: RouteProtegidaProps) {
  const { isLoading, isAuthenticated, user } = useAuth()
  const location = useLocation()
  const params = useParams() as Record<string, string | undefined>

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user && roles && roles.length > 0 && !tenerAlgunRol(user, roles)) {
    return <Navigate to="/acceso-denegado" replace />
  }
  if (user && permisos && permisos.length > 0 && !tieneAlgunPermiso(user, permisos)) {
    return <Navigate to="/acceso-denegado" replace />
  }
  if (user && validar && !validar(user, params)) {
    return <Navigate to="/acceso-denegado" replace />
  }

  return <Outlet />
}