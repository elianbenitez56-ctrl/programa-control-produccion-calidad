import { ArrowLeft, ShieldX } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { etiquetaRol } from "@/lib/permisos"

export function AccesoDenegadoPage() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldX className="h-8 w-8 text-destructive" strokeWidth={1.75} />
      </div>
      <h2 className="text-title-lg font-bold">Acceso Denegado</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Usted no tiene permisos para acceder a esta sección. Su perfil
        {user ? ` (${etiquetaRol(user)})` : ""} no está autorizado para este módulo.
      </p>
      <Button asChild className="mt-6" variant="default">
        <Link to="/inicio">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Link>
      </Button>
    </div>
  )
}