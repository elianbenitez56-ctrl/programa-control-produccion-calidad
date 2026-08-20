"""Entidades de dominio del Módulo Autenticación.

Entidades puras: el ORM (infrastructure) las materializa; el dominio no
depende de SQLAlchemy.
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class UserState(str, Enum):
    """Estados de un usuario (catálogo definido en el modelo de datos)."""

    ACTIVO = "activo"
    INACTIVO = "inactivo"
    SUSPENDIDO = "suspendido"


class LoginMethod(str, Enum):
    """Métodos de acceso permitidos (RN-OPE-001)."""

    PASSWORD = "password"
    PIN = "pin"
    QR = "qr"
    RFID = "rfid"


@dataclass
class User:
    """Usuario del sistema con sus credenciales (dominio puro)."""

    id: str
    usuario: str
    email: str | None
    nombre: str
    apellidos: str
    estado: UserState
    pin_hash: str | None = None
    rfid_tag: str | None = None
    qr_secret: str | None = None
    password_hash: str | None = None
    codigo: str | None = None
    documento: str | None = None
    planta: str | None = None
    area: str | None = None
    maquina: str | None = None
    supervisor: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    roles: list["Rol"] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def full_name(self) -> str:
        return f"{self.nombre} {self.apellidos}".strip()

    def is_active(self) -> bool:
        return self.estado == UserState.ACTIVO

    def has_role(self, codigo: str) -> bool:
        return any(rol.codigo == codigo for rol in self.roles)

    def permisos(self) -> set[str]:
        """Conjunto de permisos `recurso:accion` del usuario."""
        return {p.codigo for rol in self.roles for p in rol.permisos}


@dataclass
class Rol:
    """Rol del sistema con sus permisos."""

    id: str
    codigo: str
    nombre: str
    es_sistema: bool = False
    permisos: list["Permiso"] = field(default_factory=list)


@dataclass
class Permiso:
    """Permiso granular recurso:accion."""

    id: str
    codigo: str
    modulo: str
    recurso: str
    accion: str


@dataclass
class SesionAutenticacion:
    """Sesión de autenticación (token access + refresh)."""

    id: str
    usuario_id: str
    token_hash: str | None
    refresh_hash: str
    expira: datetime
    revocada: bool
    ip: str | None
    dispositivo: str | None
    created_at: datetime | None = None


@dataclass
class SesionOperario:
    """Sesión operativa de planta (usuario + máquina + turno)."""

    id: str
    usuario_id: str
    maquina_id: str
    turno_id: str | None
    kiosko_id: str
    metodo_acceso: LoginMethod
    hora_inicio: datetime
    hora_fin: datetime | None
    motivo_cierre: str | None
    estado: str  # 'activa' | 'cerrada' (catálogo estados)
    planta_id: str | None = None