"""Registro central de modelos ORM (importa todos para poblar el metadata)."""
from app.infrastructure.orm.base import AuditMixin, Base  # noqa: F401
from app.infrastructure.orm.bitacora import Bitacora  # noqa: F401
from app.infrastructure.orm.configuracion import (  # noqa: F401
    Area,
    Color,
    ConfiguracionSistema,
    Estado,
    Kiosko,
    Maquina,
    Planta,
    Turno,
    TurnoDia,
)
from app.infrastructure.orm.identidad import (  # noqa: F401
    Permiso,
    Rol,
    RolPermiso,
    SesionAutenticacion,
    SesionOperario,
    Usuario,
    UsuarioRol,
)
from app.infrastructure.orm.inventario import (  # noqa: F401
    MovimientoInventario,
    Producto,
)

__all__ = [
    "Base",
    "AuditMixin",
    "Area",
    "Bitacora",
    "Color",
    "ConfiguracionSistema",
    "Estado",
    "Kiosko",
    "Maquina",
    "MovimientoInventario",
    "Permiso",
    "Planta",
    "Producto",
    "Rol",
    "RolPermiso",
    "SesionAutenticacion",
    "SesionOperario",
    "Turno",
    "TurnoDia",
    "Usuario",
    "UsuarioRol",
]
