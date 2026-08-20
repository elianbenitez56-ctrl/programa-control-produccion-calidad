import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/**
 * Sesión MES activa: planta, sección y máquina seleccionadas.
 * Se persiste en localStorage para que los registros conserven el
 * contexto (filtros globales) y sobreviva a recargas.
 */

export interface MesSeleccion {
  plantaId: string | null
  seccionId: string | null
  maquinaId: string | null
}

interface MesContextValue {
  seleccion: MesSeleccion
  setSeleccion: (seleccion: MesSeleccion) => void
}

const STORAGE_KEY = "sigpc.mes.sesion"

const EMPTY: MesSeleccion = { plantaId: null, seccionId: null, maquinaId: null }

function loadSeleccion(): MesSeleccion {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<MesSeleccion>
    return {
      plantaId: typeof parsed.plantaId === "string" ? parsed.plantaId : null,
      seccionId: typeof parsed.seccionId === "string" ? parsed.seccionId : null,
      maquinaId: typeof parsed.maquinaId === "string" ? parsed.maquinaId : null,
    }
  } catch {
    return EMPTY
  }
}

const MesContext = createContext<MesContextValue | undefined>(undefined)

export function MesProvider({ children }: { children: ReactNode }) {
  const [seleccion, setSeleccionState] = useState<MesSeleccion>(() => loadSeleccion())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seleccion))
    } catch {
      // almacenamiento no disponible: la sesión solo vive en memoria
    }
  }, [seleccion])

  const value = useMemo<MesContextValue>(
    () => ({ seleccion, setSeleccion: setSeleccionState }),
    [seleccion],
  )

  return <MesContext.Provider value={value}>{children}</MesContext.Provider>
}

export function useMes(): MesContextValue {
  const ctx = useContext(MesContext)
  if (!ctx) {
    throw new Error("useMes debe usarse dentro de <MesProvider>")
  }
  return ctx
}