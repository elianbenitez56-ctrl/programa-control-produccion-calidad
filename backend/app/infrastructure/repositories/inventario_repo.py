"""Repositorios SQLAlchemy del Módulo Inventario.

Implementan los puertos `ProductoRepository` y `MovimientoRepository` sobre
AsyncSession. El stock disponible se deriva por agregación de movimientos
(SUM de cantidades) — no existe tabla de stock que se pueda desincronizar.
"""
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.inventario_ports import (
    MovimientoRepository,
    ProductoRepository,
    StockLine,
)
from app.domain.entities.inventario import MovimientoInventario, Producto
from app.infrastructure.orm.inventario import (
    MovimientoInventario as MovimientoInventarioORM,
)
from app.infrastructure.orm.inventario import (
    Producto as ProductoORM,
)


def _uuid() -> str:
    return str(uuid.uuid4())


def _producto_domain(orm: ProductoORM) -> Producto:
    return Producto(
        id=orm.id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        descripcion=orm.descripcion,
        unidad=orm.unidad,
        activo=orm.activo,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _movimiento_domain(orm: MovimientoInventarioORM) -> MovimientoInventario:
    return MovimientoInventario(
        id=orm.id,
        producto_id=orm.producto_id,
        planta_id=orm.planta_id,
        tipo=orm.tipo,
        cantidad=float(orm.cantidad),
        motivo=orm.motivo,
        referencia=orm.referencia,
        fecha=orm.fecha,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


class SqlProductoRepository(ProductoRepository):
    """Implementación de ProductoRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self, solo_activos: bool = False) -> list[Producto]:
        stmt = select(ProductoORM).order_by(ProductoORM.codigo)
        if solo_activos:
            stmt = stmt.where(ProductoORM.activo.is_(True))
        result = await self.session.execute(stmt)
        return [_producto_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, producto_id: str) -> Producto | None:
        orm = await self.session.get(ProductoORM, producto_id)
        return _producto_domain(orm) if orm else None

    async def get_by_codigo(self, codigo: str) -> Producto | None:
        result = await self.session.execute(
            select(ProductoORM).where(func.lower(ProductoORM.codigo) == codigo.strip().lower())
        )
        orm = result.scalar_one_or_none()
        return _producto_domain(orm) if orm else None

    async def create(self, producto: Producto) -> Producto:
        orm = ProductoORM(
            id=_uuid(),
            codigo=producto.codigo,
            nombre=producto.nombre,
            descripcion=producto.descripcion,
            unidad=producto.unidad,
            activo=producto.activo,
        )
        self.session.add(orm)
        await self.session.flush()
        return _producto_domain(orm)

    async def update(self, producto: Producto) -> None:
        orm = await self.session.get(ProductoORM, producto.id)
        if orm is None:
            return
        orm.codigo = producto.codigo
        orm.nombre = producto.nombre
        orm.descripcion = producto.descripcion
        orm.unidad = producto.unidad
        orm.activo = producto.activo
        await self.session.flush()

    async def set_activo(self, producto_id: str, activo: bool) -> None:
        orm = await self.session.get(ProductoORM, producto_id)
        if orm is None:
            return
        orm.activo = activo
        await self.session.flush()


class SqlMovimientoRepository(MovimientoRepository):
    """Implementación de MovimientoRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, movimiento: MovimientoInventario) -> MovimientoInventario:
        orm = MovimientoInventarioORM(
            id=_uuid(),
            producto_id=movimiento.producto_id,
            planta_id=movimiento.planta_id,
            tipo=movimiento.tipo,
            cantidad=movimiento.cantidad,
            referencia=movimiento.referencia,
            motivo=movimiento.motivo,
            fecha=movimiento.fecha,
        )
        self.session.add(orm)
        await self.session.flush()
        return _movimiento_domain(orm)

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
        base = select(MovimientoInventarioORM)
        count_base = select(func.count()).select_from(MovimientoInventarioORM)
        condiciones = []
        if producto_id:
            condiciones.append(MovimientoInventarioORM.producto_id == producto_id)
        if planta_id:
            condiciones.append(MovimientoInventarioORM.planta_id == planta_id)
        if tipo:
            condiciones.append(MovimientoInventarioORM.tipo == tipo)
        if fecha_desde:
            condiciones.append(MovimientoInventarioORM.fecha >= fecha_desde)
        if fecha_hasta:
            condiciones.append(MovimientoInventarioORM.fecha <= fecha_hasta)

        stmt = base.where(*condiciones).order_by(
            MovimientoInventarioORM.fecha.desc(),
            MovimientoInventarioORM.created_at.desc(),
        ).limit(limit).offset(offset)
        total = await self.session.scalar(count_base.where(*condiciones)) or 0
        result = await self.session.execute(stmt)
        return [_movimiento_domain(o) for o in result.scalars().all()], total

    async def stock_por_producto(
        self,
        planta_id: str | None = None,
        producto_id: str | None = None,
    ) -> list[StockLine]:
        stmt = (
            select(
                MovimientoInventarioORM.producto_id,
                MovimientoInventarioORM.planta_id,
                func.sum(MovimientoInventarioORM.cantidad).label("stock"),
            )
            .group_by(MovimientoInventarioORM.producto_id, MovimientoInventarioORM.planta_id)
        )
        if planta_id:
            stmt = stmt.where(MovimientoInventarioORM.planta_id == planta_id)
        if producto_id:
            stmt = stmt.where(MovimientoInventarioORM.producto_id == producto_id)
        result = await self.session.execute(stmt)
        return [
            StockLine(producto_id=pid, planta_id=plid, cantidad=float(stock))
            for pid, plid, stock in result.all()
        ]

    async def stock_de(self, producto_id: str, planta_id: str) -> float:
        stmt = (
            select(func.coalesce(func.sum(MovimientoInventarioORM.cantidad), 0.0))
            .where(MovimientoInventarioORM.producto_id == producto_id)
            .where(MovimientoInventarioORM.planta_id == planta_id)
        )
        return float(await self.session.scalar(stmt) or 0.0)
