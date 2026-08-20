"""Matriz de permisos del sistema (RN-PRM / reglas §18 análisis funcional).

Se usa para el seed de `roles`, `permisos` y `rol_permisos` al inicializar la
base. Nada se queda "quemado" en código de lógica: esta es una definición de
catálogo (faz única).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class _Perm:
    codigo: str
    modulo: str
    recurso: str
    accion: str
    descripcion: str


@dataclass(frozen=True)
class _RolDef:
    codigo: str
    nombre: str
    descripcion: str
    permisos: tuple[str, ...] = field(default_factory=tuple)


PERMISOS: tuple[_Perm, ...] = (
    # ---- Identidad ----
    _Perm("usuario:ver", "identidad", "usuario", "ver", "Consultar usuarios"),
    _Perm("usuario:crear", "identidad", "usuario", "crear", "Crear usuarios"),
    _Perm("usuario:editar", "identidad", "usuario", "editar", "Editar usuarios"),
    _Perm("usuario:eliminar", "identidad", "usuario", "eliminar", "Eliminar usuarios"),
    _Perm("rol:ver", "identidad", "rol", "ver", "Consultar roles"),
    _Perm("rol:configurar", "identidad", "rol", "configurar", "Configurar roles y permisos"),
    # ---- Catálogos ----
    _Perm("catalogo:ver", "catalogos", "catalogo", "ver", "Consultar catálogos"),
    _Perm("catalogo:configurar", "catalogos", "catalogo", "configurar", "Configurar catálogos"),
    # ---- Plantas / áreas / máquinas / turnos ----
    _Perm("planta:ver", "configuracion", "planta", "ver", "Consultar plantas"),
    _Perm("planta:configurar", "configuracion", "planta", "configurar", "Configurar plantas"),
    _Perm("area:ver", "configuracion", "area", "ver", "Consultar áreas"),
    _Perm("area:configurar", "configuracion", "area", "configurar", "Configurar áreas"),
    _Perm("maquina:ver", "configuracion", "maquina", "ver", "Consultar máquinas"),
    _Perm("maquina:configurar", "configuracion", "maquina", "configurar", "Configurar máquinas"),
    _Perm("turno:ver", "configuracion", "turno", "ver", "Consultar turnos"),
    _Perm("turno:configurar", "configuracion", "turno", "configurar", "Configurar turnos"),
    # ---- Órdenes de producción ----
    _Perm("op:ver", "produccion", "op", "ver", "Ver órdenes asignadas"),
    _Perm("op:crear", "produccion", "op", "crear", "Crear órdenes"),
    _Perm("op:asignar", "produccion", "op", "asignar", "Asignar/máquina/turno"),
    _Perm("op:iniciar", "produccion", "op", "iniciar", "Iniciar producción"),
    _Perm("op:finalizar", "produccion", "op", "finalizar", "Finalizar orden"),
    _Perm("op:eliminar", "produccion", "op", "eliminar", "Eliminar registros de producción"),
    # ---- Paradas ----
    _Perm("parada:registrar", "produccion", "parada", "registrar", "Registrar paradas"),
    _Perm("parada:gestionar", "produccion", "parada", "gestionar", "Gestionar/corregir paradas"),
    # ---- Calidad ----
    _Perm("calidad:inspeccionar", "calidad", "inspeccion", "ejecutar", "Ejecutar inspecciones"),
    _Perm("calidad:nc", "calidad", "nc", "gestionar", "Gestionar NC"),
    _Perm("calidad:defecto", "calidad", "defecto", "registrar", "Registrar defectos"),
    # ---- Mantenimiento ----
    _Perm("mantenimiento:gestionar", "mantenimiento", "mantenimiento", "gestionar", "Gestionar mantenimiento"),
    # ---- Reportes / dashboards ----
    _Perm("dashboard:ver", "analitica", "dashboard", "ver", "Ver dashboards"),
    _Perm("reporte:exportar", "analitica", "reporte", "exportar", "Exportar reportes"),
    # ---- Auditoría ----
    _Perm("auditoria:consultar", "auditoria", "auditoria", "consultar", "Consultar auditoría"),
    # ---- Inventario ----
    _Perm("inventario:ver", "inventario", "inventario", "ver", "Consultar stock y movimientos"),
    _Perm("inventario:registrar", "inventario", "inventario", "registrar",
          "Registrar movimientos de inventario"),
    _Perm("inventario:configurar", "inventario", "inventario", "configurar",
          "Configurar catálogo de productos"),
)


ROLES: tuple[_RolDef, ...] = (
    _RolDef(
        "operario",
        "Operario",
        "Opera una máquina asignada en el piso",
        (
            "op:ver",
            "op:iniciar",
            "parada:registrar",
            "calidad:defecto",
            "maquina:ver",
        ),
    ),
    _RolDef(
        "calidad",
        "Calidad",
        "Inspector de calidad en línea",
        (
            "op:ver",
            "calidad:inspeccionar",
            "calidad:nc",
            "calidad:defecto",
        ),
    ),
    _RolDef(
        "supervisor",
        "Supervisor",
        "Supervisión y programación en planta",
        (
            "op:ver",
            "op:crear",
            "op:asignar",
            "op:finalizar",
            "parada:registrar",
            "parada:gestionar",
            "calidad:nc",
            "area:ver",
            "maquina:ver",
            "turno:ver",
            "dashboard:ver",
            "inventario:ver",
            "inventario:registrar",
        ),
    ),
    _RolDef(
        "gerencia",
        "Gerencia",
        "Indicadores y análisis histórico",
        ("dashboard:ver", "reporte:exportar", "maquina:ver", "area:ver", "turno:ver",
         "inventario:ver"),
    ),
    _RolDef(
        "auditoria",
        "Auditoría",
        "Solo lectura completa",
        (
            "usuario:ver",
            "rol:ver",
            "catalogo:ver",
            "planta:ver",
            "area:ver",
            "maquina:ver",
            "turno:ver",
            "op:ver",
            "dashboard:ver",
            "auditoria:consultar",
            "inventario:ver",
        ),
    ),
    _RolDef(
        "admin",
        "Administrador",
        "Administración total del sistema",
        tuple(p.codigo for p in PERMISOS),
    ),
)


def all_permisos() -> list[_Perm]:
    return list(PERMISOS)


def all_roles() -> list[_RolDef]:
    return list(ROLES)
