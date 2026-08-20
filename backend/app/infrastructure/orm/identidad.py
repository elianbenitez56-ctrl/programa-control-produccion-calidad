"""Modelos ORM del módulo de Identidad (usuarios, roles, permisos, sesiones).

Siguen `docs/modelo-base-de-datos.md` §2. Desviaciones controladas (Módulo 1):
- `usuarios.password_hash`, `intentos_fallidos`, `bloqueado_hasta`: requeridos por
  el diseño del Módulo 1 (login con contraseña y lockout); no existían en el modelo.
- `sesiones_autenticacion` sin `token_hash`: el access token es stateless y nunca
  se persiste; se guarda sólo el hash del refresh + `jti` (rotación M1-D5).
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.orm.base import AuditMixin, Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Usuario(Base, AuditMixin):
    """Tabla `usuarios` (identidad única de toda persona)."""

    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    usuario: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True, unique=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(120), nullable=False)
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rfid_tag: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    qr_secret: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    codigo: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)
    documento: Mapped[str | None] = mapped_column(String(40), nullable=True)
    planta: Mapped[str | None] = mapped_column(String(60), nullable=True)
    area: Mapped[str | None] = mapped_column(String(60), nullable=True)
    maquina: Mapped[str | None] = mapped_column(String(60), nullable=True)
    supervisor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    intentos_fallidos: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activo")
    idioma: Mapped[str] = mapped_column(String(8), nullable=False, server_default="es")
    ultima_conexion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_por: Mapped[str | None] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=True)

    roles: Mapped[list["Rol"]] = relationship(
        secondary="usuarios_roles", back_populates="usuarios", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_usuarios_estado", "estado"),
        CheckConstraint("length(usuario) >= 4", name="ck_usuarios_usuario_min"),
        CheckConstraint(
            "pin_hash IS NOT NULL OR rfid_tag IS NOT NULL OR qr_secret IS NOT NULL "
            "OR password_hash IS NOT NULL",
            name="ck_usuarios_credencial",
        ),
        CheckConstraint("estado IN ('activo','inactivo','suspendido')", name="ck_usuarios_estado"),
    )


class Rol(Base, AuditMixin):
    """Tabla `roles`."""

    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    es_sistema: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    usuarios: Mapped[list[Usuario]] = relationship(
        secondary="usuarios_roles", back_populates="roles"
    )
    permisos: Mapped[list["Permiso"]] = relationship(
        secondary="rol_permisos", back_populates="roles", lazy="selectin"
    )


class Permiso(Base, AuditMixin):
    """Tabla `permisos` (catálogo granular recurso:accion)."""

    __tablename__ = "permisos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    modulo: Mapped[str] = mapped_column(String(40), nullable=False)
    recurso: Mapped[str] = mapped_column(String(40), nullable=False)
    accion: Mapped[str] = mapped_column(String(40), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)

    roles: Mapped[list[Rol]] = relationship(secondary="rol_permisos", back_populates="permisos")


class RolPermiso(Base):
    """Tabla `rol_permisos` (matriz rol→permiso)."""

    __tablename__ = "rol_permisos"

    rol_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permiso_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (
        UniqueConstraint("rol_id", "permiso_id", name="uq_rol_permisos_rol_permiso"),
    )


class UsuarioRol(Base):
    """Tabla `usuarios_roles` (asignación usuario × planta × rol con vigencia)."""

    __tablename__ = "usuarios_roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=False)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    rol_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id"), nullable=False)
    vigencia_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    vigencia_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("usuario_id", "planta_id", "rol_id", name="uq_usuarios_roles_usuario_planta_rol"),
        CheckConstraint("vigencia_fin IS NULL OR vigencia_fin >= vigencia_inicio", name="ck_usuarios_roles_vigencia"),
        Index("ix_usuarios_roles_usuario_activo", "usuario_id", "activo"),
    )


class SesionAutenticacion(Base):
    """Tabla `sesiones_autenticacion` (solo hash del refresh + jti)."""

    __tablename__ = "sesiones_autenticacion"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    usuario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    refresh_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    jti: Mapped[str] = mapped_column(String(36), nullable=False)
    expira: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revocada: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    dispositivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_sesiones_autenticacion_usuario_activa", "usuario_id"),
        Index("ix_sesiones_autenticacion_jti", "jti"),
    )


class SesionOperario(Base):
    """Tabla `sesiones_operario` (sesión operativa: usuario+máquina+turno)."""

    __tablename__ = "sesiones_operario"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    usuario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    maquina_id: Mapped[str] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=False)
    turno_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("turnos.id"), nullable=True)
    kiosko_id: Mapped[str] = mapped_column(String(36), ForeignKey("kioskos.id"), nullable=False)
    metodo_acceso: Mapped[str] = mapped_column(String(10), nullable=False)
    hora_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    hora_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_cierre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activa")

    __table_args__ = (
        Index("ix_sesiones_operario_usuario_activa", "usuario_id"),
        Index("ix_sesiones_operario_maquina_activa", "maquina_id"),
        Index("ix_sesiones_operario_turno", "turno_id", "hora_inicio"),
        CheckConstraint(
            "metodo_acceso IN ('qr','rfid','pin')", name="ck_sesiones_operario_metodo"
        ),
        CheckConstraint(
            "motivo_cierre IS NULL OR motivo_cierre IN "
            "('logout','timeout','cambio_maquina','fin_turno','reemplazo')",
            name="ck_sesiones_operario_motivo",
        ),
        CheckConstraint("hora_fin IS NULL OR hora_fin > hora_inicio", name="ck_sesiones_operario_horas"),
    )
