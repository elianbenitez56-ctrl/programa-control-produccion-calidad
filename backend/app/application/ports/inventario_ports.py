"""Puertos (interfaces) del Módulo Inventario.

El dominio/aplicación define contratos; infrastructure los implementa sobre
SQLAlchemy (repositorios) y la capa API los orquesta por recurso.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

from app.domain.entities.inventario import MovimientoInventario, Producto


@dataclass
class StockLine:
    """Stock derivado de un producto en una planta (agregación)."""

    producto_id: str
    planta_id: str
    cantidad: float


class ProductoRepository(ABC):
    """Persistencia del catálogo de productos."""

    @abstractmethod
    async def list_all(self, solo_activos: bool = False) -> list[Producto]: ...

    @abstractmethod
    async def get_by_id(self, producto_id: str) -> Producto | None: ...

    @abstractmethod
    async def get_by_codigo(self, codigo: str) -> Producto | None: ...

    @abstractmethod
    async def create(self, producto: Producto) -> Producto: ...

    @abstractmethod
    async def update(self, producto: Producto) -> None: ...

    @abstractmethod
    async def set_activo(self, producto_id: str, activo: bool) -> None: ...


class MovimientoRepository(ABC):
    """Persistencia de movimientos de inventario y stock derivado."""

    @abstractmethod
    async def create(self, movimiento: MovimientoInventario) -> MovimientoInventario: ...

    @abstractmethod
    async def list_all(
        self,
        producto_id: str | None = None,
        planta_id: str | None = None,
        tipo: str | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[MovimientoInventario], int]:
        """Consulta paginada de movimientos con filtros opcionales."""

    @abstractmethod
    async def stock_por_producto(
        self,
        planta_id: str | None = None,
        producto_id: str | None = None,
    ) -> list[StockLine]:
        """Stock actual (SUM de cantidades) agrupado por producto y planta."""

    @abstractmethod
    async def stock_de(self, producto_id: str, planta_id: str) -> float:
        """Saldo actual de un producto en una planta (0 si nunca hubo movimientos)."""
