function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/** Colores de las paletas del tema, resueltos desde las variables CSS */
export const chartColors = {
  blue: () => `hsl(${cssVar("--chart-1")})`,
  purple: () => `hsl(${cssVar("--chart-2")})`,
  green: () => `hsl(${cssVar("--chart-3")})`,
  amber: () => `hsl(${cssVar("--chart-4")})`,
  red: () => `hsl(${cssVar("--chart-5")})`,
  muted: () => `hsl(${cssVar("--muted-foreground")})`,
  border: () => `hsl(${cssVar("--border")})`,
  grid: () => `hsl(${cssVar("--border")})`,
  text: () => `hsl(${cssVar("--muted-foreground")})`,
  card: () => `hsl(${cssVar("--card")})`,
}

export const chartGradients = {
  blue: () =>
    `linear-gradient(180deg, hsl(${cssVar("--chart-1")} / 0.35), transparent)`,
  purple: () =>
    `linear-gradient(180deg, hsl(${cssVar("--chart-2")} / 0.35), transparent)`,
  green: () =>
    `linear-gradient(180deg, hsl(${cssVar("--chart-3")} / 0.35), transparent)`,
  amber: () =>
    `linear-gradient(180deg, hsl(${cssVar("--chart-4")} / 0.35), transparent)`,
  red: () =>
    `linear-gradient(180deg, hsl(${cssVar("--chart-5")} / 0.35), transparent)`,
}
