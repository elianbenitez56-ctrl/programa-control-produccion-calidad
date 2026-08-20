"""Casos de uso del Módulo Inventario (productos y movimientos de stock).

Catálogo global de productos (referencias) y movimientos de inventario por
producto y planta (RF16/P9: liberación de producción pasa a stock). El stock
se deriva por agregación de movimientos con signo: entrada > 0, salida < 0 y
ajuste libre; se valida que ningún movimiento deje el saldo negativo
(RN-INV-001). Cada mutación queda registrada en la bitácora.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from app.application.ports.auth_ports import AuditRepository
from app.application.ports.configuracion_ports import PlantaRepository
from app.application.ports.inventario_ports import MovimientoRepository, ProductoRepository
from app.application.serializers import (
    movimiento_inventario_publico,
    producto_publico,
)
from app.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    EntityNotFoundError,
)
from app.domain.entities.inventario import MovimientoInventario, Producto

_MODULO = "inventario"

_TIPOS_MOVIMIENTO = ("entrada", "salida", "ajuste")


def _validar_codigo(codigo: str) -> None:
    if not codigo or not codigo.strip():
        raise BusinessRuleError("CODIGO_VACIO",
                                message="El código del producto es obligatorio")


# ------------------------------------------------------------ Productos


@dataclass
class ProductoDatos:
    codigo: str
    nombre: str
    descripcion: str | None = None
    unidad: str = "t"
    activo: bool = True


class ProductosUseCases:
    """CRUD del catálogo global de productos (referencias)."""

    def __init__(self, productos: ProductoRepository, audit: AuditRepository) -> None:
        self.productos = productos
        self.audit = audit

    async def listar(self, solo_activos: bool = False) -> list[dict[str, Any]]:
        return [producto_publico(p) for p in await self.productos.list_all(solo_activos)]

    async def ver(self, producto_id: str) -> dict[str, Any]:
        producto = await self.productos.get_by_id(producto_id)
        if producto is None:
            raise EntityNotFoundError("producto")
        return producto_publico(producto)

    async def crear(self, datos: ProductoDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo)
        if await self.productos.get_by_codigo(datos.codigo) is not None:
            raise ConflictError("PRODUCTO_DUPLICADO",
                                message="El código de producto ya existe")
        producto = await self.productos.create(Producto(id="", **datos.__dict__))
        await self._audit("producto_creado", "producto", producto.id, None,
                          producto_publico(producto), usuario_id, ip, request_id)
        return producto_publico(producto)

    async def editar(self, producto_id: str, datos: ProductoDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo)
        producto = await self.productos.get_by_id(producto_id)
        if producto is None:
            raise EntityNotFoundError("producto")
        existente = await self.productos.get_by_codigo(datos.codigo)
        if existente is not None and existente.id != producto_id:
            raise ConflictError("PRODUCTO_DUPLICADO",
                                message="El código de producto ya existe")
        anterior = producto_publico(producto)
        producto.codigo = datos.codigo
        producto.nombre = datos.nombre
        producto.descripcion = datos.descripcion
        producto.unidad = datos.unidad
        producto.activo = datos.activo
        await self.productos.update(producto)
        await self._audit("producto_editado", "producto", producto.id, anterior,
                          producto_publico(producto), usuario_id, ip, request_id)
        return producto_publico(producto)

    async def desactivar(self, producto_id: str, usuario_id: str | None,
                         ip: str | None, request_id: str | None) -> None:
        producto = await self.productos.get_by_id(producto_id)
        if producto is None:
            raise EntityNotFoundError("producto")
        await self.productos.set_activo(producto_id, False)
        await self._audit("producto_desactivado", "producto", producto_id,
                          producto_publico(producto), None, usuario_id, ip, request_id)

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# ------------------------------------------------------------ Movimientos


@dataclass
class MovimientoDatos:
    producto_id: str
    planta_id: str
    tipo: str
    cantidad: float
    motivo: str
    referencia: str | None = None
    fecha: date | None = None


class MovimientosUseCases:
    """Movimientos de stock (entrada/salida/ajuste) y stock derivado."""

    def __init__(self, movimientos: MovimientoRepository, productos: ProductoRepository,
                 plantas: PlantaRepository, audit: AuditRepository) -> None:
        self.movimientos = movimientos
        self.productos = productos
        self.plantas = plantas
        self.audit = audit

    async def listar(self, producto_id: str | None = None, planta_id: str | None = None,
                     tipo: str | None = None, fecha_desde: date | None = None,
                     fecha_hasta: date | None = None, limit: int = 50,
                     offset: int = 0) -> dict[str, Any]:
        if tipo and tipo not in _TIPOS_MOVIMIENTO:
            raise BusinessRuleError("TIPO_MOVIMIENTO_INVALIDO",
                                    message="El tipo de movimiento indicado no es válido")
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        movimientos, total = await self.movimientos.list_all(
            producto_id=producto_id, planta_id=planta_id, tipo=tipo,
            fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, limit=limit, offset=offset,
        )
        nombres = await self._nombres_resueltos(movimientos)
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "movimientos": [movimiento_inventario_publico(m, nombres.get(m.id))
                            for m in movimientos],
        }

    async def registrar(self, datos: MovimientoDatos, usuario_id: str | None,
                        ip: str | None, request_id: str | None) -> dict[str, Any]:
        if datos.tipo not in _TIPOS_MOVIMIENTO:
            raise BusinessRuleError(
                "TIPO_MOVIMIENTO_INVALIDO",
                message="El tipo debe ser entrada, salida o ajuste",
            )
        if datos.cantidad == 0:
            raise BusinessRuleError("CANTIDAD_INVALIDA",
                                    message="La cantidad no puede ser cero")
        if datos.tipo in ("entrada", "salida") and datos.cantidad < 0:
            raise BusinessRuleError("CANTIDAD_INVALIDA",
                                    message="La cantidad de entrada o salida debe ser positiva")
        if not datos.motivo or not datos.motivo.strip():
            raise BusinessRuleError("MOTIVO_VACIO",
                                    message="El motivo del movimiento es obligatorio")

        producto = await self.productos.get_by_id(datos.producto_id)
        if producto is None:
            raise EntityNotFoundError("producto")
        if not producto.activo:
            raise BusinessRuleError("PRODUCTO_INACTIVO",
                                    message="El producto está desactivado y no admite movimientos")
        if await self.plantas.get_by_id(datos.planta_id) is None:
            raise EntityNotFoundError("planta")

        cantidad = datos.cantidad if datos.tipo != "salida" else -abs(datos.cantidad)
        if cantidad < 0:
            saldo = await self.movimientos.stock_de(datos.producto_id, datos.planta_id)
            if saldo + cantidad < 0:
                raise BusinessRuleError(
                    "STOCK_INSUFICIENTE",
                    message="El movimiento dejaría el stock en negativo",
                    details={"stock_actual": saldo},
                )

        movimiento = await self.movimientos.create(MovimientoInventario(
            id="", producto_id=datos.producto_id, planta_id=datos.planta_id,
            tipo=datos.tipo, cantidad=cantidad, motivo=datos.motivo.strip(),
            referencia=datos.referencia or None, fecha=datos.fecha or date.today(),
        ))
        await self._audit("movimiento_creado", "movimiento_inventario", movimiento.id,
                          None, movimiento_inventario_publico(movimiento),
                          usuario_id, ip, request_id)
        nombres = await self._nombres_resueltos([movimiento])
        return movimiento_inventario_publico(movimiento, nombres.get(movimiento.id))

    async def stock(self, planta_id: str | None = None,
                    producto_id: str | None = None) -> list[dict[str, Any]]:
        lineas = await self.movimientos.stock_por_producto(planta_id, producto_id)
        productos = {p.id: p for p in await self.productos.list_all()}
        plantas = {p.id: p for p in await self.plantas.list_all()}
        filas: list[dict[str, Any]] = []
        for linea in lineas:
            producto = productos.get(linea.producto_id)
            planta = plantas.get(linea.planta_id)
            filas.append({
                "producto_id": linea.producto_id,
                "producto_codigo": producto.codigo if producto else None,
                "producto_nombre": producto.nombre if producto else None,
                "unidad": producto.unidad if producto else None,
                "planta_id": linea.planta_id,
                "planta_codigo": planta.codigo if planta else None,
                "planta_nombre": planta.nombre if planta else None,
                "cantidad": linea.cantidad,
            })
        return filas

    async def _nombres_resueltos(
        self, movimientos: list[MovimientoInventario],
    ) -> dict[str, dict[str, Any]]:
        ids_productos = {m.producto_id for m in movimientos}
        ids_plantas = {m.planta_id for m in movimientos}
        productos = {p.id: p for p in await self.productos.list_all()
                     if p.id in ids_productos}
        plantas = {p.id: p for p in await self.plantas.list_all()
                   if p.id in ids_plantas}
        contexto: dict[str, dict[str, Any]] = {}
        for m in movimientos:
            producto = productos.get(m.producto_id)
            planta = plantas.get(m.planta_id)
            contexto[m.id] = {
                "producto_codigo": producto.codigo if producto else None,
                "producto_nombre": producto.nombre if producto else None,
                "unidad": producto.unidad if producto else None,
                "planta_codigo": planta.codigo if planta else None,
                "planta_nombre": planta.nombre if planta else None,
            }
        return contexto

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)
