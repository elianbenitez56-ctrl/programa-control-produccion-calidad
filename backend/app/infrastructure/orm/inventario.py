"""Modelos ORM del Módulo Inventario.

Catálogo global de `productos` y `movimientos_inventario` por producto y
planta. `cantidad` es con signo (entrada > 0, salida < 0, ajuste libre) y el
stock disponible se calcula por agregación sobre los movimientos; no existe
ninguna tabla de stock que se pueda desincronizar.
"""
import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.orm.base import AuditMixin, Base

_TIPOS_MOVIMIENTO = ("entrada", "salida", "ajuste")


def _uuid() -> str:
    return str(uuid.uuid4())


class Producto(Base, AuditMixin):
    """Tabla `productos`: catálogo global de referencias.

    El catálogo es global (no por planta); el stock sí es por planta y se
    calcula desde `movimientos_inventario`.
    """

    __tablename__ = "productos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unidad: Mapped[str] = mapped_column(String(10), nullable=False, server_default="t")
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class MovimientoInventario(Base, AuditMixin):
    """Tabla `movimientos_inventario`: cambios de stock por producto y planta.

    El signo de `cantidad` está garantizado por CHECK: entrada positiva,
    salida negativa y ajuste libre. El stock actual es SUM(cantidad) agrupado
    por producto + planta.
    """

    __tablename__ = "movimientos_inventario"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    producto_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False
    )
    planta_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("plantas.id"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    cantidad: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(30), nullable=True)
    motivo: Mapped[str] = mapped_column(String(120), nullable=False)
    fecha: Mapped[date] = mapped_column(
        Date, nullable=False, server_default="CURRENT_DATE"
    )

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('entrada','salida','ajuste')",
            name="ck_movimientos_inventario_tipo",
        ),
        CheckConstraint(
            "cantidad <> 0", name="ck_movimientos_inventario_cantidad_no_cero"
        ),
        CheckConstraint(
            "(tipo <> 'entrada' OR cantidad > 0) AND (tipo <> 'salida' OR cantidad < 0)",
            name="ck_movimientos_inventario_signo",
        ),
        Index("ix_movimientos_inventario_producto_planta", "producto_id", "planta_id"),
        Index("ix_movimientos_inventario_planta", "planta_id"),
        Index("ix_movimientos_inventario_fecha", "fecha"),
    )
