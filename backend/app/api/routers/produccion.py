"""Endpoints del módulo Producción (OP como entidad raíz).

CRUD de órdenes de producción, registro diario por turno, paradas e
incidencias de calidad, más el resumen agregado que alimenta Dashboard,
Reportes e Indicadores (una única fuente de datos).
"""
from datetime import date, datetime, time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_permiso
from app.api.use_cases_factory import (
    ProduccionUseCases,
    _http_meta,
    build_produccion_use_cases,
)
from app.application.use_cases.produccion import (
    IncidenciaDatos,
    OrdenDatos,
    ParadaDatos,
    RegistroDatos,
)
from app.core.database import get_db

router = APIRouter(prefix="/produccion", tags=["produccion"])


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> ProduccionUseCases:
    request.state.db_session = session
    return build_produccion_use_cases(session)


async def _commit(request: Request) -> None:
    await request.state.db_session.commit()


def _dt(valor: str | None) -> datetime | None:
    if not valor:
        return None
    dt = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=datetime.UTC)


def _dia(valor: str | None) -> date | None:
    return date.fromisoformat(valor) if valor else None


_VER_OP = Depends(require_permiso("op:ver"))
_CREAR_OP = Depends(require_permiso("op:crear"))
_ASIGNAR_OP = Depends(require_permiso("op:asignar"))
_INICIAR_OP = Depends(require_permiso("op:iniciar"))
_FINALIZAR_OP = Depends(require_permiso("op:finalizar"))
_ELIMINAR_OP = Depends(require_permiso("op:eliminar"))
_REGISTRAR_PARADA = Depends(require_permiso("parada:registrar"))
_DEFECTO = Depends(require_permiso("calidad:defecto"))
_NC = Depends(require_permiso("calidad:nc"))
_VER_DASHBOARD = Depends(require_permiso("dashboard:ver"))


# ------------------------------------------------------------ Órdenes


class OrdenRequest(BaseModel):
    cliente: str = Field(min_length=1, max_length=120)
    producto: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=255)
    unidad: str = Field(default="t", max_length=10)
    cantidad_planificada: float | None = Field(default=None, gt=0)
    prioridad: int = Field(default=5, ge=1, le=10)
    fecha_emision: str | None = None
    fecha_programada: str | None = None
    fecha_fin_estimada: str | None = None
    planta_id: str = Field(min_length=1)
    area_id: str = Field(min_length=1)
    maquina_id: str = Field(min_length=1)
    operario_id: str | None = None
    turno_id: str | None = None


def _orden_datos(body: OrdenRequest) -> OrdenDatos:
    return OrdenDatos(
        cliente=body.cliente, producto=body.producto, descripcion=body.descripcion,
        unidad=body.unidad, cantidad_planificada=body.cantidad_planificada,
        prioridad=body.prioridad, fecha_emision=_dia(body.fecha_emision),
        fecha_programada=_dia(body.fecha_programada),
        fecha_fin_estimada=_dia(body.fecha_fin_estimada),
        planta_id=body.planta_id,
        area_id=body.area_id, maquina_id=body.maquina_id, operario_id=body.operario_id,
        turno_id=body.turno_id,
    )


@router.get("/catalogo")
async def catalogo_produccion(
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.ordenes.catalogo()


@router.get("/ordenes")
async def listar_ordenes(
    planta_id: str | None = Query(default=None),
    maquina_id: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"ordenes": await uc.ordenes.listar(planta_id, maquina_id, estado)}


@router.get("/ordenes/{op_id}")
async def ver_orden(
    op_id: str,
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.ordenes.ver(op_id)


@router.post("/ordenes")
async def crear_orden(
    body: OrdenRequest,
    request: Request,
    auth: CurrentUser = _CREAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.ordenes.crear(_orden_datos(body), auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.put("/ordenes/{op_id}")
async def editar_orden(
    op_id: str,
    body: OrdenRequest,
    request: Request,
    auth: CurrentUser = _ASIGNAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.ordenes.editar(op_id, _orden_datos(body), auth.user_id, ip, request_id)
    await _commit(request)
    return result


class EstadoRequest(BaseModel):
    estado: str = Field(min_length=1)


@router.post("/ordenes/{op_id}/iniciar")
async def iniciar_orden(
    op_id: str,
    request: Request,
    auth: CurrentUser = _INICIAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.ordenes.cambiar_estado(op_id, "en_produccion",
                                             auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.post("/ordenes/{op_id}/finalizar")
async def finalizar_orden(
    op_id: str,
    request: Request,
    auth: CurrentUser = _FINALIZAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.ordenes.cambiar_estado(op_id, "finalizada", auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.post("/ordenes/{op_id}/estado")
async def cambiar_estado_orden(
    op_id: str,
    body: EstadoRequest,
    request: Request,
    auth: CurrentUser = _ASIGNAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.ordenes.cambiar_estado(op_id, body.estado, auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.delete("/ordenes/{op_id}")
async def eliminar_orden(
    op_id: str,
    request: Request,
    auth: CurrentUser = _ELIMINAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.ordenes.eliminar(op_id, auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "eliminado": True}


# --------------------------------------------------- Registros diarios


class RegistroRequest(BaseModel):
    op_id: str = Field(min_length=1)
    fecha: str | None = None
    turno_id: str = Field(min_length=1)
    operario_id: str = Field(min_length=1)
    planta_id: str = Field(min_length=1)
    area_id: str = Field(min_length=1)
    maquina_id: str = Field(min_length=1)
    produccion_total: float = Field(ge=0)
    produccion_buena: float = Field(default=0, ge=0)
    produccion_rechazada: float = Field(default=0, ge=0)
    unidad: str = Field(default="t", max_length=10)
    hora_inicio: str | None = None
    hora_fin: str | None = None
    tiempo_operativo_min: int | None = Field(default=None, ge=0)
    observaciones: str | None = Field(default=None, max_length=2000)


def _registro_datos(body: RegistroRequest) -> RegistroDatos:
    return RegistroDatos(
        op_id=body.op_id, fecha=_dia(body.fecha), turno_id=body.turno_id,
        operario_id=body.operario_id, planta_id=body.planta_id, area_id=body.area_id,
        maquina_id=body.maquina_id, produccion_total=body.produccion_total,
        produccion_buena=body.produccion_buena,
        produccion_rechazada=body.produccion_rechazada, unidad=body.unidad,
        hora_inicio=time.fromisoformat(body.hora_inicio) if body.hora_inicio else None,
        hora_fin=time.fromisoformat(body.hora_fin) if body.hora_fin else None,
        tiempo_operativo_min=body.tiempo_operativo_min, observaciones=body.observaciones,
    )


@router.get("/registros")
async def listar_registros(
    op_id: str | None = Query(default=None),
    fecha: str | None = Query(default=None),
    planta_id: str | None = Query(default=None),
    area_id: str | None = Query(default=None),
    maquina_id: str | None = Query(default=None),
    turno_id: str | None = Query(default=None),
    operario_id: str | None = Query(default=None),
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"registros": await uc.registros.listar(
        op_id, _dia(fecha), planta_id, area_id, maquina_id, turno_id, operario_id)}


@router.get("/registros/{registro_id}")
async def ver_registro(
    registro_id: str,
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.registros.ver(registro_id)


@router.post("/registros")
async def crear_registro(
    body: RegistroRequest,
    request: Request,
    auth: CurrentUser = _INICIAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.registros.crear(_registro_datos(body), auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.put("/registros/{registro_id}")
async def editar_registro(
    registro_id: str,
    body: RegistroRequest,
    request: Request,
    auth: CurrentUser = _INICIAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.registros.editar(registro_id, _registro_datos(body),
                                       auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.delete("/registros/{registro_id}")
async def eliminar_registro(
    registro_id: str,
    request: Request,
    auth: CurrentUser = _ELIMINAR_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.registros.eliminar(registro_id, auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "eliminado": True}


# -------------------------------------------------------------- Paradas


class ParadaRequest(BaseModel):
    maquina_id: str = Field(min_length=1)
    motivo: str = Field(min_length=1, max_length=120)
    tipo: str = Field(default="no_planeada", pattern="^(planeada|no_planeada)$")
    op_id: str | None = None
    registro_id: str | None = None
    turno_id: str | None = None
    inicio: str | None = None
    observacion: str | None = Field(default=None, max_length=2000)


class CerrarParadaRequest(BaseModel):
    fin: str = Field(min_length=1)


@router.get("/paradas")
async def listar_paradas(
    maquina_id: str | None = Query(default=None),
    op_id: str | None = Query(default=None),
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    turno_id: str | None = Query(default=None),
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"paradas": await uc.paradas.listar(
        maquina_id, op_id, _dia(fecha_inicio), _dia(fecha_fin), turno_id)}


@router.get("/paradas/{parada_id}")
async def ver_parada(
    parada_id: str,
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.paradas.ver(parada_id)


@router.post("/paradas")
async def crear_parada(
    body: ParadaRequest,
    request: Request,
    auth: CurrentUser = _REGISTRAR_PARADA,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.paradas.crear(ParadaDatos(
        maquina_id=body.maquina_id, motivo=body.motivo, inicio=_dt(body.inicio),
        tipo=body.tipo, op_id=body.op_id, registro_id=body.registro_id,
        turno_id=body.turno_id, observacion=body.observacion,
    ), auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.post("/paradas/{parada_id}/cerrar")
async def cerrar_parada(
    parada_id: str,
    body: CerrarParadaRequest,
    request: Request,
    auth: CurrentUser = _REGISTRAR_PARADA,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    fin = _dt(body.fin)
    if fin is None:
        from app.core.exceptions import BusinessRuleError
        raise BusinessRuleError("FIN_PARADA_OBLIGATORIO",
                                message="El fin de la parada es obligatorio")
    result = await uc.paradas.cerrar(parada_id, fin, auth.user_id, ip, request_id)
    await _commit(request)
    return result


# --------------------------------------------------------------- Calidad


class IncidenciaRequest(BaseModel):
    maquina_id: str = Field(min_length=1)
    tipo: str = Field(default="defecto", pattern="^(defecto|inspeccion|nc)$")
    op_id: str | None = None
    registro_id: str | None = None
    codigo: str | None = Field(default=None, max_length=30)
    descripcion: str | None = Field(default=None, max_length=2000)
    lote: str | None = Field(default=None, max_length=40)
    cantidad: float | None = Field(default=None, ge=0)
    turno_id: str | None = None
    fecha: str | None = None


@router.get("/calidad")
async def listar_calidad(
    op_id: str | None = Query(default=None),
    maquina_id: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"incidencias": await uc.calidad.listar(
        op_id, maquina_id, tipo, _dia(fecha_inicio), _dia(fecha_fin))}


@router.get("/calidad/{incidencia_id}")
async def ver_incidencia(
    incidencia_id: str,
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.calidad.ver(incidencia_id)


@router.post("/calidad")
async def crear_incidencia(
    body: IncidenciaRequest,
    request: Request,
    auth: CurrentUser = _DEFECTO,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.calidad.crear(IncidenciaDatos(
        maquina_id=body.maquina_id, tipo=body.tipo, op_id=body.op_id,
        registro_id=body.registro_id, codigo=body.codigo, descripcion=body.descripcion,
        lote=body.lote, cantidad=body.cantidad, turno_id=body.turno_id,
        fecha=_dia(body.fecha),
    ), auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.post("/calidad/{incidencia_id}/estado")
async def cambiar_estado_incidencia(
    incidencia_id: str,
    body: EstadoRequest,
    request: Request,
    auth: CurrentUser = _NC,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.calidad.cambiar_estado(incidencia_id, body.estado,
                                             auth.user_id, ip, request_id)
    await _commit(request)
    return result


# --------------------------------------------------------------- Resumen


@router.get("/trazabilidad")
async def trazabilidad(
    op_id: str | None = Query(default=None),
    numero_op: str | None = Query(default=None),
    lote: str | None = Query(default=None),
    _auth: CurrentUser = _VER_OP,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.trazabilidad.buscar(op_id=op_id, numero_op=numero_op, lote=lote)


@router.get("/resumen")
async def resumen_produccion(
    fecha: str | None = Query(default=None),
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    planta_id: str | None = Query(default=None),
    area_id: str | None = Query(default=None),
    maquina_id: str | None = Query(default=None),
    turno_id: str | None = Query(default=None),
    op_id: str | None = Query(default=None),
    _auth: CurrentUser = _VER_DASHBOARD,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.resumen.resumen(
        fecha=_dia(fecha), fecha_desde=_dia(fecha_desde), fecha_hasta=_dia(fecha_hasta),
        planta_id=planta_id, area_id=area_id, maquina_id=maquina_id,
        turno_id=turno_id, op_id=op_id,
    )


@router.get("/indicadores")
async def indicadores_produccion(
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    planta_id: str | None = Query(default=None),
    area_id: str | None = Query(default=None),
    maquina_id: str | None = Query(default=None),
    turno_id: str | None = Query(default=None),
    _auth: CurrentUser = _VER_DASHBOARD,
    uc: ProduccionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.resumen.indicadores(
        fecha_desde=_dia(fecha_desde), fecha_hasta=_dia(fecha_hasta),
        planta_id=planta_id, area_id=area_id, maquina_id=maquina_id,
        turno_id=turno_id,
    )
