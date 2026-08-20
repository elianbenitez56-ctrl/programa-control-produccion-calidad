import axios, { AxiosError } from "axios"

import type { ErrorResponse } from "@/types/auth"

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1"

export const ACCESS_TOKEN_KEY = "sigpc.access_token"
export const REFRESH_TOKEN_KEY = "sigpc.refresh_token"

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (refreshToken) {
        try {
          const { data } = await axios.post<{ access_token: string }>(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { "Content-Type": "application/json" } },
          )
          localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          clearTokens()
          window.location.href = "/login"
        }
      } else {
        clearTokens()
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  },
)

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const code = error.response?.data?.error?.code
    switch (code) {
      case "AUTENTICACION_INVALIDA":
        return "Usuario o contraseña incorrectos."
      case "CUENTA_BLOQUEADA":
        return "La cuenta está bloqueada por intentos fallidos. Intente más tarde."
      case "TOKEN_EXPIRADO":
        return "La sesión ha expirado. Inicie sesión nuevamente."
      case "TOO_MANY_REQUESTS":
        return "Demasiados intentos. Espere un momento e intente de nuevo."
      default:
        return error.response?.data?.error?.message ?? "Error de conexión con el servidor."
    }
  }
  return "Error de conexión con el servidor."
}
