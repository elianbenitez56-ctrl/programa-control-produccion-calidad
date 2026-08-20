"""Endpoints del Módulo Inventario (productos y movimientos de stock).

Catálogo global de productos (referencias) y movimientos de inventario por
producto y planta. Permisos: `inventario:ver` para consultas, `inventario:registrar`
para movimientos y `inventario:configurar` para el CRUD de productos.
"""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_permiso
from app.api.use_cases_factory import (
    InventarioUseCases,
    _http_meta,
    build_inventario_use_cases,
)
from app.application.use_cases.inventario import MovimientoDatos, ProductoDatos
from app.core.database import get_db

router = APIRouter(prefix="/inventario", tags=["inventario"])


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> InventarioUseCases:
    request.state.db_session = session
    return build_inventario_use_cases(session)


async def _commit(request: Request) -> None:
    await request.state.db_session.commit()


_VER_INVENTARIO = Depends(require_permiso("inventario:ver"))
_REGISTRAR_INVENTARIO = Depends(require_permiso("inventario:registrar"))
_CONFIGURAR_INVENTARIO = Depends(require_permiso("inventario:configurar"))


# ------------------------------------------------------------ Productos


class ProductoRequest(BaseModel):
    codigo: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=255)
    unidad: str = Field(default="t", max_length=10)
    activo: bool = True


@router.get("/productos")
async def listar_productos(
    solo_activos: bool = Query(default=False),
    _auth: CurrentUser = _VER_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"productos": await uc.productos.listar(solo_activos)}


@router.get("/productos/{producto_id}")
async def ver_producto(
    producto_id: str,
    _auth: CurrentUser = _VER_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.productos.ver(producto_id)


@router.post("/productos")
async def crear_producto(
    body: ProductoRequest,
    request: Request,
    auth: CurrentUser = _CONFIGURAR_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.productos.crear(
        ProductoDatos(**body.model_dump()), auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.put("/productos/{producto_id}")
async def editar_producto(
    producto_id: str,
    body: ProductoRequest,
    request: Request,
    auth: CurrentUser = _CONFIGURAR_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.productos.editar(
        producto_id, ProductoDatos(**body.model_dump()), auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.delete("/productos/{producto_id}")
async def desactivar_producto(
    producto_id: str,
    request: Request,
    auth: CurrentUser = _CONFIGURAR_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.productos.desactivar(producto_id, auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "desactivado": True}


# ------------------------------------------------------------ Movimientos


class MovimientoRequest(BaseModel):
    producto_id: str = Field(min_length=1)
    planta_id: str = Field(min_length=1)
    tipo: str = Field(pattern="^(entrada|salida|ajuste)$")
    cantidad: float
    motivo: str = Field(min_length=1, max_length=120)
    referencia: str | None = Field(default=None, max_length=30)
    fecha: str | None = None


@router.post("/movimientos")
async def registrar_movimiento(
    body: MovimientoRequest,
    request: Request,
    auth: CurrentUser = _REGISTRAR_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    fecha = date.fromisoformat(body.fecha) if body.fecha else None
    result = await uc.movimientos.registrar(
        MovimientoDatos(**body.model_dump(), fecha=fecha), auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.get("/movimientos")
async def listar_movimientos(
    producto_id: str | None = Query(default=None),
    planta_id: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _auth: CurrentUser = _VER_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    desde = date.fromisoformat(fecha_desde) if fecha_desde else None
    hasta = date.fromisoformat(fecha_hasta) if fecha_hasta else None
    return await uc.movimientos.listar(
        producto_id=producto_id, planta_id=planta_id, tipo=tipo,
        fecha_desde=desde, fecha_hasta=hasta, limit=limit, offset=offset,
    )


# ------------------------------------------------------------ Stock


@router.get("/stock")
async def ver_stock(
    planta_id: str | None = Query(default=None),
    producto_id: str | None = Query(default=None),
    _auth: CurrentUser = _VER_INVENTARIO,
    uc: InventarioUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"stock": await uc.movimientos.stock(planta_id, producto_id)}
