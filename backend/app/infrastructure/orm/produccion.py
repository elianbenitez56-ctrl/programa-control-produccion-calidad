"""Modelos ORM del módulo Producción (OP como entidad raíz del MES).

Siguen la arquitectura unificada acordada: toda la información operativa
(registro diario, paradas, calidad) cuelga de `ordenes_produccion`, que a su
vez referencia el catálogo real de `plantas`, `areas`, `maquinas`, `turnos` y
`usuarios`. Reportes, dashboard e indicadores se calculan por agregación
sobre estas tablas; no existe ninguna duplicación de datos.
"""
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.orm.base import AuditMixin, Base

_ESTADOS_OP = ("borrador", "asignada", "en_produccion", "pausada", "finalizada", "cancelada")
_ESTADOS_CALIDAD = ("abierta", "en_revision", "cerrada")
_TIPOS_PARADA = ("planeada", "no_planeada")
_TIPOS_CALIDAD = ("defecto", "inspeccion", "nc")


def _uuid() -> str:
    return str(uuid.uuid4())


class OrdenProduccion(Base, AuditMixin):
    """Tabla `ordenes_produccion`: entidad raíz de todo el flujo MES.

    Una OP pertenece a una planta, se ejecuta en una máquina (dentro de un
    área) y puede asignarse a un operario y turno. Su estado alimenta la
    transición del catálogo `estados` de la máquina.
    """

    __tablename__ = "ordenes_produccion"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    numero_op: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    cliente: Mapped[str] = mapped_column(String(120), nullable=False)
    producto: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unidad: Mapped[str] = mapped_column(String(10), nullable=False, server_default="t")
    cantidad_planificada: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    cantidad_producida: Mapped[float] = mapped_column(
        Numeric(14, 4), nullable=False, server_default="0"
    )
    prioridad: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="borrador")
    fecha_emision: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_programada: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_fin_estimada: Mapped[date | None] = mapped_column(Date, nullable=True)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    area_id: Mapped[str] = mapped_column(String(36), ForeignKey("areas.id"), nullable=False)
    maquina_id: Mapped[str] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=False)
    operario_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("usuarios.id"), nullable=True
    )
    turno_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("turnos.id"), nullable=True)
    fecha_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("prioridad BETWEEN 1 AND 10", name="ck_ordenes_produccion_prioridad"),
        CheckConstraint(
            "estado IN ('borrador','asignada','en_produccion','pausada','finalizada','cancelada')",
            name="ck_ordenes_produccion_estado",
        ),
        CheckConstraint("cantidad_planificada IS NULL OR cantidad_planificada > 0",
                        name="ck_ordenes_produccion_cantidad_planificada"),
        CheckConstraint("fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio",
                        name="ck_ordenes_produccion_fechas"),
        Index("ix_ordenes_produccion_estado", "estado"),
        Index("ix_ordenes_produccion_maquina_estado", "maquina_id", "estado"),
        Index("ix_ordenes_produccion_fecha_emision", "fecha_emision"),
    )


class RegistroDiario(Base, AuditMixin):
    """Tabla `registros_diarios`: captura del turno asociada a una OP.

    Única fuente de las cantidades de producción. Cada fila combina OP +
    planta + área + máquina + operario + turno + fecha, de modo que las
    consultas de dashboard/reportes/indicadores agregan solo aquí.
    """

    __tablename__ = "registros_diarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    op_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ordenes_produccion.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    turno_id: Mapped[str] = mapped_column(String(36), ForeignKey("turnos.id"), nullable=False)
    operario_id: Mapped[str] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=False)
    planta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=False)
    area_id: Mapped[str] = mapped_column(String(36), ForeignKey("areas.id"), nullable=False)
    maquina_id: Mapped[str] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=False)
    hora_inicio: Mapped[time | None] = mapped_column(Time, nullable=True)
    hora_fin: Mapped[time | None] = mapped_column(Time, nullable=True)
    produccion_total: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    produccion_buena: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    produccion_rechazada: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    unidad: Mapped[str] = mapped_column(String(10), nullable=False, server_default="t")
    tiempo_operativo_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("op_id", "fecha", "turno_id", name="uq_registros_diarios_op_fecha_turno"),
        CheckConstraint("produccion_buena >= 0", name="ck_registros_diarios_buena"),
        CheckConstraint("produccion_rechazada >= 0", name="ck_registros_diarios_rechazada"),
        CheckConstraint(
            "produccion_total >= 0 AND produccion_buena + produccion_rechazada <= produccion_total",
            name="ck_registros_diarios_coherencia",
        ),
        CheckConstraint("hora_fin IS NULL OR hora_inicio IS NULL OR hora_fin > hora_inicio",
                        name="ck_registros_diarios_horas"),
        Index("ix_registros_diarios_fecha", "fecha"),
        Index("ix_registros_diarios_maquina_fecha", "maquina_id", "fecha"),
        Index("ix_registros_diarios_op", "op_id"),
        Index("ix_registros_diarios_turno", "turno_id"),
    )


class Parada(Base, AuditMixin):
    """Tabla `paradas`: tiempos improductivos anclados a OP y registro.

    El cierre de turno y la captura de paradas escriben aquí; la duración se
    calcula automáticamente (minutos) al cerrar la parada.
    """

    __tablename__ = "paradas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    op_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ordenes_produccion.id", ondelete="SET NULL"), nullable=True
    )
    registro_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("registros_diarios.id", ondelete="SET NULL"), nullable=True
    )
    maquina_id: Mapped[str] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=False)
    turno_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("turnos.id"), nullable=True)
    motivo: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, server_default="no_planeada")
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duracion_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("tipo IN ('planeada','no_planeada')", name="ck_paradas_tipo"),
        CheckConstraint("fin IS NULL OR fin > inicio", name="ck_paradas_fin"),
        CheckConstraint("duracion_min IS NULL OR duracion_min >= 0", name="ck_paradas_duracion"),
        Index("ix_paradas_maquina_inicio", "maquina_id", "inicio"),
        Index("ix_paradas_op", "op_id"),
        Index("ix_paradas_registro", "registro_id"),
    )


class IncidenciaCalidad(Base, AuditMixin):
    """Tabla `incidencias_calidad`: hallazgos de calidad del lote/OP.

    Cubre defectos (operario), inspecciones (calidad) y NC. Al cerrar la OP,
    el estado de calidad se obtiene agregando las incidencias abiertas.
    """

    __tablename__ = "incidencias_calidad"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    op_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ordenes_produccion.id", ondelete="SET NULL"), nullable=True
    )
    registro_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("registros_diarios.id", ondelete="SET NULL"), nullable=True
    )
    maquina_id: Mapped[str] = mapped_column(String(36), ForeignKey("maquinas.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    codigo: Mapped[str | None] = mapped_column(String(30), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    lote: Mapped[str | None] = mapped_column(String(40), nullable=True)
    cantidad: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="abierta")
    fecha: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    turno_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("turnos.id"), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('defecto','inspeccion','nc')", name="ck_incidencias_calidad_tipo"
        ),
        CheckConstraint(
            "estado IN ('abierta','en_revision','cerrada')", name="ck_incidencias_calidad_estado"
        ),
        Index("ix_incidencias_calidad_op", "op_id"),
        Index("ix_incidencias_calidad_maquina_fecha", "maquina_id", "fecha"),
    )
