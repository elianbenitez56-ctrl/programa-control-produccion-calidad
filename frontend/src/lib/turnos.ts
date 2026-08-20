/** Turnos de planta: A (06:00–14:00), B (14:00–22:00), C (22:00–06:00) */

export interface TurnoInfo {
  clave: string
  label: string
  horaInicio: string
  horaFin: string
}

export const turnos: TurnoInfo[] = [
  { clave: "A", label: "Turno A (06:00–14:00)", horaInicio: "06:00", horaFin: "14:00" },
  { clave: "B", label: "Turno B (14:00–22:00)", horaInicio: "14:00", horaFin: "22:00" },
  { clave: "C", label: "Turno C (22:00–06:00)", horaInicio: "22:00", horaFin: "06:00" },
]

export function turnoParaHora(hora: number): TurnoInfo {
  if (hora >= 6 && hora < 14) return turnos[0]
  if (hora >= 14 && hora < 22) return turnos[1]
  return turnos[2]
}

export function turnoActual(): TurnoInfo {
  return turnoParaHora(new Date().getHours())
}