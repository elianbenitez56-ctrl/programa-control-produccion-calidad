"""Modelo ORM de la bitácora de auditoría (RN-AUD-001).

Tabla particionada por RANGE mensual (`fecha`). El particionado físico se
define en la migración; el modelo declara el esquema de columnas.
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, JSON, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.orm.base import Base


class Bitacora(Base):
    """Tabla `bitacora` (registro inmutable de toda acción)."""

    __tablename__ = "bitacora"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"), primary_key=True, autoincrement=True
    )
    planta_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plantas.id"), nullable=True)
    usuario_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("usuarios.id"), nullable=True)
    accion: Mapped[str] = mapped_column(String(60), nullable=False)
    modulo: Mapped[str] = mapped_column(String(40), nullable=False)
    entidad: Mapped[str] = mapped_column(String(60), nullable=False)
    entidad_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    valor_anterior: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=True
    )
    valor_nuevo: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=True
    )
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    dispositivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    kiosko_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("kioskos.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    __table_args__ = (
        Index("ix_bitacora_entidad", "entidad", "entidad_id"),
        Index("ix_bitacora_usuario", "usuario_id", "fecha"),
        Index("ix_bitacora_accion", "accion", "fecha"),
    )
