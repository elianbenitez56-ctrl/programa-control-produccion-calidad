import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T extends Record<string, unknown>> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideable?: boolean
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[]
  data: T[]
  title?: string
  searchPlaceholder?: string
  pageSize?: number
  /** Render personalizado del valor como badge de estado (columna "estado" o "resultado") */
  badgeKeys?: string[]
  /** Render de la columna fija "Acciones" al final de la tabla (opcional) */
  actions?: (row: T) => React.ReactNode
  className?: string
}

const PAGE_SIZES = [5, 10, 25]

function exportCsv<T extends Record<string, unknown>>(
  columns: DataTableColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const header = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",")
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key]
        const text = value === undefined || value === null ? "" : String(value)
        return `"${text.replace(/"/g, '""')}"`
      })
      .join(","),
  )
  const csv = [header, ...lines].join("\r\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportPdf<T extends Record<string, unknown>>(
  title: string,
  columns: DataTableColumn<T>[],
  rows: T[],
): void {
  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) return
  const head = columns.map((c) => `<th>${c.header}</th>`).join("")
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${String(row[c.key] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("")
  win.document.write(`
    <html lang="es">
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 32px; color: #0f172a; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          p { color: #64748b; margin: 0 0 24px; font-size: 13px; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th { text-align: left; background: #f1f5f9; padding: 8px 10px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
          tr:hover td { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generado el ${new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date())} · ${rows.length} registros</p>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body>
    </html>`)
  win.document.close()
  win.print()
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  title = "Registros",
  searchPlaceholder = "Buscar…",
  pageSize = 5,
  badgeKeys = [],
  actions,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [page, setPage] = React.useState(0)
  const [visibleKeys, setVisibleKeys] = React.useState<Set<string>>(
    new Set(columns.map((c) => c.key)),
  )
  const [rowsPerPage, setRowsPerPage] = React.useState(pageSize)

  const visibleColumns = columns.filter((c) => visibleKeys.has(c.key))

  const filtered = React.useMemo(() => {
    let rows = data
    const term = search.trim().toLowerCase()
    if (term) {
      rows = rows.filter((row) =>
        columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(term)),
      )
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""), "es")
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return rows
  }, [data, search, columns, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const renderCell = (row: T, col: DataTableColumn<T>) => {
    if (col.render) return col.render(row)
    const raw = row[col.key]
    if (badgeKeys.includes(col.key)) {
      const text = String(raw ?? "")
      const tone =
        text.toLowerCase().includes("rechaz")
          ? "destructive"
          : text.toLowerCase().includes("pausa") ||
              text.toLowerCase().includes("bajo") ||
              text.toLowerCase().includes("en revisión")
            ? "warning"
            : text.toLowerCase().includes("program") ||
                text.toLowerCase().includes("disponible") ||
                text.toLowerCase().includes("activo")
              ? "success"
              : "secondary"
      return <Badge variant={tone}>{text}</Badge>
    }
    return String(raw ?? "—")
  }

  const start = filtered.length === 0 ? 0 : safePage * rowsPerPage + 1
  const end = Math.min(filtered.length, safePage * rowsPerPage + rowsPerPage)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-2 h-4 w-4" />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visibleKeys.has(c.key)}
                  onCheckedChange={() => toggleColumn(c.key)}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(visibleColumns, filtered, title)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-chart-3" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPdf(title, visibleColumns, filtered)}
          >
            <FileText className="mr-2 h-4 w-4 text-chart-5" />
            PDF
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {visibleColumns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn("whitespace-nowrap", c.className)}
                  onClick={c.sortable !== false ? () => toggleSort(c.key) : undefined}
                >
                  <button
                    type="button"
                    disabled={c.sortable === false}
                    className={cn(
                      "inline-flex items-center gap-1 uppercase",
                      c.sortable === false ? "cursor-default" : "cursor-pointer hover:text-foreground",
                      sortKey === c.key && "text-primary",
                    )}
                  >
                    {c.header}
                    {c.sortable === false ? null : sortKey === c.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                </TableHead>
              ))}
              {actions && (
                <TableHead className="w-20 whitespace-nowrap text-center uppercase">
                  Acciones
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (actions ? 1 : 0)}
                  className="h-28 text-center text-muted-foreground"
                >
                  Sin resultados para mostrar
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow key={i} className="animate-fade-in">
                  {visibleColumns.map((c) => (
                    <TableCell key={c.key} className={cn("whitespace-nowrap", c.className)}>
                      {renderCell(row, c)}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="whitespace-nowrap text-center">
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? "0 registros"
            : `Mostrando ${start}–${end} de ${filtered.length} registros`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Filas por página
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setPage(0)
              }}
              className="rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-16 text-center text-sm text-muted-foreground">
              {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
