export function formatNumber(value: number, maxDecimals = 0): string {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: maxDecimals,
  }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number, maxDecimals = 1): string {
  return `${new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: maxDecimals,
  }).format(value)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${formatNumber(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return "Buenos días"
  if (hour >= 12 && hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

export function todayLong(): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}
