import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { api, clearTokens, setTokens } from "@/lib/api"
import type { LoginResponse, Usuario } from "@/types/auth"

interface AuthContextValue {
  user: Usuario | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (usuario: string, password: string) => Promise<Usuario>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("sigpc.refresh_token")
      await api.post("/auth/logout", { refresh_token: refreshToken })
    } catch {
      // El logout local siempre procede aunque falle el backend.
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  const login = useCallback(async (usuario: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/auth/login", { usuario, password })
    setTokens(data.access_token, data.refresh_token)
    setUser(data.usuario)
    return data.usuario
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const token = localStorage.getItem("sigpc.access_token")
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const { data } = await api.get<Usuario>("/auth/me")
        if (!cancelled) setUser(data)
      } catch {
        clearTokens()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  }
  return ctx
}
