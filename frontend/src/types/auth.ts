export interface Usuario {
  id: string
  usuario: string
  email: string | null
  nombre: string
  apellidos: string
  roles: string[]
  permisos: string[]
  /** Asignación del puesto (autodetectada al iniciar sesión). */
  documento: string | null
  estado: string
  planta: string | null
  area: string | null
  maquina: string | null
  supervisor: string | null
  ultima_conexion: string | null
  fecha_creacion: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  usuario: Usuario
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
    request_id: string | null
  }
}

export interface SesionActiva {
  id: string
  ip: string | null
  dispositivo: string | null
  creada: string | null
  expira: string
}