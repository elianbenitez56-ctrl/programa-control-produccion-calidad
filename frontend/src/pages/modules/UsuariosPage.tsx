import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { plantas } from "@/config/plantas"
import { api, getErrorMessage } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"

interface UsuarioRow extends Record<string, unknown> {
  id: string
  usuario: string
  email: string | null
  nombre: string
  apellidos: string
  documento: string | null
  estado: string
  planta: string | null
  area: string | null
  maquina: string | null
  supervisor: string | null
  roles: string[]
  ultima_conexion: string | null
  fecha_creacion: string | null
}

interface RolCatalogo {
  codigo: string
  nombre: string
}

interface FormUsuario {
  usuario: string
  nombre: string
  apellidos: string
  email: string
  documento: string
  password: string
  rol: string
  planta: string
  area: string
  maquina: string
  supervisor: string
  estado: string
}

const EMPTY_FORM: FormUsuario = {
  usuario: "",
  nombre: "",
  apellidos: "",
  email: "",
  documento: "",
  password: "",
  rol: "",
  planta: "ninguna",
  area: "ninguna",
  maquina: "ninguna",
  supervisor: "",
  estado: "activo",
}

export function UsuariosPage() {
  const { user: sesion } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [roles, setRoles] = useState<RolCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<UsuarioRow | null>(null)
  const [form, setForm] = useState<FormUsuario>(EMPTY_FORM)
  const [guardando, setGuardando] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [u, r] = await Promise.all([
        api.get<{ usuarios: UsuarioRow[] }>("/usuarios"),
        api.get<{ roles: RolCatalogo[] }>("/usuarios/roles"),
      ])
      setUsuarios(u.data.usuarios)
      setRoles(r.data.roles)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const plantaSel = plantas.find((p) => p.id === form.planta)
  const seccionSel = plantaSel?.secciones.find((s) => s.id === form.area)

  const setField = (campo: keyof FormUsuario, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (campo === "planta") setForm((f) => ({ ...f, area: "ninguna", maquina: "ninguna" }))
    if (campo === "area") setForm((f) => ({ ...f, maquina: "ninguna" }))
  }

  const rolLabel = (codigo: string) =>
    roles.find((r) => r.codigo === codigo)?.nombre ?? codigo

  function abrirNuevo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function abrirEditar(row: UsuarioRow) {
    setEditando(row)
    setForm({
      usuario: row.usuario,
      nombre: row.nombre,
      apellidos: row.apellidos,
      email: row.email ?? "",
      documento: row.documento ?? "",
      password: "",
      rol: row.roles[0] ?? "",
      planta: row.planta ?? "ninguna",
      area: row.area ?? "ninguna",
      maquina: row.maquina ?? "ninguna",
      supervisor: row.supervisor ?? "",
      estado: row.estado,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function guardar() {
    setGuardando(true)
    setFormError(null)
    try {
      const body = {
        usuario: form.usuario,
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email || null,
        documento: form.documento || null,
        rol: form.rol,
        planta: form.planta === "ninguna" ? null : form.planta,
        area: form.area === "ninguna" ? null : form.area,
        maquina: form.maquina === "ninguna" ? null : form.maquina,
        supervisor: form.supervisor || null,
        estado: form.estado,
      }
      if (editando) {
        const payload = form.password ? { ...body, password: form.password } : body
        await api.put(`/usuarios/${editando.id}`, payload)
        setNotice(`Usuario "${form.usuario}" actualizado.`)
      } else {
        await api.post("/usuarios", { ...body, password: form.password })
        setNotice(`Usuario "${form.usuario}" creado.`)
      }
      setDialogOpen(false)
      await cargar()
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(row: UsuarioRow) {
    try {
      const estado = row.estado === "activo" ? "inactivo" : "activo"
      await api.patch(`/usuarios/${row.id}/estado`, { estado })
      setNotice(`Usuario "${row.usuario}" ${estado === "activo" ? "activado" : "desactivado"}.`)
      await cargar()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function eliminar(row: UsuarioRow) {
    if (!window.confirm(`¿Eliminar al usuario "${row.usuario}"? Esta acción no se puede deshacer.`)) {
      return
    }
    try {
      await api.delete(`/usuarios/${row.id}`)
      setNotice(`Usuario "${row.usuario}" eliminado.`)
      await cargar()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const columns: DataTableColumn<UsuarioRow>[] = [
    {
      key: "usuario",
      header: "Usuario",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
            {row.usuario.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold">{row.usuario}</p>
            <p className="text-xs text-muted-foreground">
              {row.nombre} {row.apellidos}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Rol",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.roles ?? []).map((r) => (
            <Badge key={r} variant="outline">
              {rolLabel(r)}
            </Badge>
          ))}
          {(row.roles ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: "area",
      header: "Área asignada",
      render: (row) =>
        row.planta ? (
          <span className="text-xs">
            {row.planta}
            {row.area ? ` · ${row.area}` : ""}
            {row.maquina ? ` · ${row.maquina}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (row) => (
        <Badge variant={row.estado === "activo" ? "success" : "secondary"}>
          {row.estado === "activo" ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      sortable: false,
      className: "text-right",
      render: (row) => {
        const esSesion = row.usuario === sesion?.usuario
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cambiarEstado(row)}
              title={row.estado === "activo" ? "Desactivar usuario" : "Activar usuario"}
            >
              {row.estado === "activo" ? "Desactivar" : "Activar"}
            </Button>
            <Button variant="outline" size="icon" onClick={() => abrirEditar(row)} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              disabled={esSesion}
              onClick={() => eliminar(row)}
              title={esSesion ? "No puede eliminar su propia cuenta" : "Eliminar"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  const activos = usuarios.filter((u) => u.estado === "activo").length

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/inicio" className="transition-colors hover:text-foreground">
          Inicio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Administración de usuarios</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Administración de usuarios</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Gestión de cuentas, roles y asignación de puestos de trabajo
          </p>
        </div>
        <Button onClick={abrirNuevo} variant="default">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {(notice || error) && (
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
            error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-chart-3/30 bg-chart-3/10 text-chart-3",
          )}
        >
          <span>{error ?? notice}</span>
          <button
            type="button"
            className="text-xs font-semibold underline"
            onClick={() => {
              setError(null)
              setNotice(null)
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-chart-3/10 text-chart-3">
              <UsersRound className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{usuarios.length}</p>
              <p className="text-xs text-muted-foreground">Usuarios registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-chart-1/10 text-chart-1">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{activos}</p>
              <p className="text-xs text-muted-foreground">Cuentas activas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-chart-4/10 text-chart-4">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{roles.length}</p>
              <p className="text-xs text-muted-foreground">Roles disponibles</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-chart-5/10 text-chart-5">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{usuarios.length - activos}</p>
              <p className="text-xs text-muted-foreground">Cuentas inactivas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Usuarios del sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              title="Usuarios del sistema"
              columns={columns}
              data={usuarios}
              searchPlaceholder="Buscar usuario, nombre, área…"
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Actualice los datos del usuario y su asignación de puesto."
                : "Cree la cuenta y asigne rol, puesto y supervisor."}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <Input
                value={form.usuario}
                disabled={!!editando}
                onChange={(e) => setField("usuario", e.target.value)}
                placeholder="nombre.usuario"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña {!editando && "*"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder={editando ? "Dejar en blanco para no cambiarla" : "Mínimo 8 caracteres"}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input
                value={form.apellidos}
                onChange={(e) => setField("apellidos", e.target.value)}
                placeholder="Apellidos"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="correo@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={form.documento}
                onChange={(e) => setField("documento", e.target.value)}
                placeholder="Cédula / RIF"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={form.rol} onValueChange={(v) => setField("rol", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.codigo} value={r.codigo}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setField("estado", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asignación de puesto (operario)
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Planta</Label>
                <Select value={form.planta} onValueChange={(v) => setField("planta", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin asignar</SelectItem>
                    {plantas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select
                  value={form.area}
                  disabled={!plantaSel}
                  onValueChange={(v) => setField("area", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin asignar</SelectItem>
                    {plantaSel?.secciones.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Máquina</Label>
                <Select
                  value={form.maquina}
                  disabled={!seccionSel}
                  onValueChange={(v) => setField("maquina", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin asignar</SelectItem>
                    {seccionSel?.maquinas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Supervisor</Label>
              <Input
                value={form.supervisor}
                onChange={(e) => setField("supervisor", e.target.value)}
                placeholder="Nombre del supervisor"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando} variant="default">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editando ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}