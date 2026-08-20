"""Modelos ORM del módulo Configuración (dependencias del Módulo 1).

Siguen `docs/modelo-base-de-datos.md` §3. `unidades` llega en el módulo de
Catálogos; aquí se omiten las columnas que referencian esa tabla.
"""
import uuid
from datetime import datetime, time

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.orm.base import AuditMixin, Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Planta(Base, AuditMixin):
    """Tabla `plantas` (tenant del producto multi-planta)."""

    __tablename__ = "plantas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    pais: Mapped[str | None] = mapped_column(String(60), nullable=True)
    zona_horaria: Mapped[str] = mapped_column(String(50), nullable=False, server_default="America/Mexico_City")
    idioma: Mapped[str] = mapped_column(String(8), nullable=False, server_default="es")
    licencia: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class Area(Base, AuditMixin):
    """Tabla `areas` (agrupación física/funcional de máquinas)."""

    __tablename__ = "areas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    responsable_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("planta_id", "codigo", name="uq_areas_planta_codigo"),
    )


class Maquina(Base, AuditMixin):
    """Tabla `maquinas` (recurso productivo central)."""

    __tablename__ = "maquinas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    area_id: Mapped[str] = mapped_column(String(36), ForeignKey("areas.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    tiene_contador: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    tipo_contador: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="ninguno"
    )
    velocidad_maxima: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    config_contador: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    parametros: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    estado_actual_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("estados.id"), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("planta_id", "codigo", name="uq_maquinas_planta_codigo"),
        CheckConstraint(
            "(tiene_contador = false AND tipo_contador = 'ninguno') OR "
            "(tiene_contador = true AND tipo_contador IN ('opc','manual'))",
            name="ck_maquinas_contador",
        ),
    )


class Turno(Base, AuditMixin):
    """Tabla `turnos` (bloques horarios por planta)."""

    __tablename__ = "turnos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("planta_id", "codigo", name="uq_turnos_planta_codigo"),
        CheckConstraint("hora_fin <> hora_inicio", name="ck_turnos_horas_distintas"),
    )


class TurnoDia(Base):
    """Tabla `turnos_dias` (días de semana aplicables, 1=lunes..7=domingo)."""

    __tablename__ = "turnos_dias"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    turno_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("turnos.id", ondelete="CASCADE"), nullable=False
    )
    dia_semana: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("turno_id", "dia_semana", name="uq_turnos_dias_turno_dia"),
        CheckConstraint("dia_semana BETWEEN 1 AND 7", name="ck_turnos_dias_dia"),
    )


class Kiosko(Base, AuditMixin):
    """Tabla `kioskos` (dispositivo de planta asociado a una máquina)."""

    __tablename__ = "kioskos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    maquina_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=True)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    tipo_ingreso: Mapped[str] = mapped_column(String(10), nullable=False)
    token_dispositivo: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    ubicacion: Mapped[str | None] = mapped_column(String(120), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("planta_id", "codigo", name="uq_kioskos_planta_codigo"),
        CheckConstraint("tipo_ingreso IN ('qr','rfid','pin','mixto')", name="ck_kioskos_tipo_ingreso"),
    )


class Color(Base, AuditMixin):
    """Tabla `colores` (catálogo de colores)."""

    __tablename__ = "colores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    hex: Mapped[str] = mapped_column(String(7), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        CheckConstraint(
            "length(hex) = 7 AND substr(hex, 1, 1) = '#'", name="ck_colores_hex"
        ),
    )


class Estado(Base, AuditMixin):
    """Tabla `estados` (catálogo único de estados de todos los procesos)."""

    __tablename__ = "estados"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=True)
    proceso: Mapped[str] = mapped_column(String(40), nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        UniqueConstraint("proceso", "codigo", "planta_id", name="uq_estados_proceso_codigo_planta"),
    )


class ConfiguracionSistema(Base):
    """Tabla `configuraciones_sistema` (parámetros clave→valor por planta/global)."""

    __tablename__ = "configuraciones_sistema"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    planta_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=True)
    clave: Mapped[str] = mapped_column(String(80), nullable=False)
    valor: Mapped[dict] = mapped_column(JSON, nullable=False)
    tipo_dato: Mapped[str] = mapped_column(String(20), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vigente: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("clave", name="uq_config_global"),
    )
