"""Endpoints del Módulo Configuración (catálogos base por planta).

CRUD de plantas, áreas, máquinas y turnos. Cada endpoint exige el permiso
correspondiente: `*:ver` para consulta y `*:configurar` para mutaciones.
El borrado es lógico (desactivar `activo = false`).
"""
from datetime import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_permiso
from app.api.use_cases_factory import (
    ConfiguracionUseCases,
    _http_meta,
    build_configuracion_use_cases,
)
from app.application.use_cases.configuracion import (
    AreaDatos,
    MaquinaDatos,
    PlantaDatos,
    TurnoDatos,
)
from app.core.database import get_db

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> ConfiguracionUseCases:
    request.state.db_session = session
    return build_configuracion_use_cases(session)


async def _commit(request: Request) -> None:
    await request.state.db_session.commit()


_VER_PLANTA = Depends(require_permiso("planta:ver"))
_CONFIG_PLANTA = Depends(require_permiso("planta:configurar"))
_VER_AREA = Depends(require_permiso("area:ver"))
_CONFIG_AREA = Depends(require_permiso("area:configurar"))
_VER_MAQUINA = Depends(require_permiso("maquina:ver"))
_CONFIG_MAQUINA = Depends(require_permiso("maquina:configurar"))
_VER_TURNO = Depends(require_permiso("turno:ver"))
_CONFIG_TURNO = Depends(require_permiso("turno:configurar"))


# ------------------------------------------------------------- Plantas


class PlantaRequest(BaseModel):
    codigo: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=120)
    pais: str | None = Field(default=None, max_length=60)
    zona_horaria: str = Field(default="America/Mexico_City", max_length=50)
    idioma: str = Field(default="es", max_length=8)
    activo: bool = True


@router.get("/plantas")
async def listar_plantas(
    _auth: CurrentUser = _VER_PLANTA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"plantas": await uc.plantas.listar()}


@router.get("/plantas/{planta_id}")
async def ver_planta(
    planta_id: str,
    _auth: CurrentUser = _VER_PLANTA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.plantas.ver(planta_id)


@router.post("/plantas")
async def crear_planta(
    body: PlantaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_PLANTA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.plantas.crear(
        PlantaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.put("/plantas/{planta_id}")
async def editar_planta(
    planta_id: str,
    body: PlantaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_PLANTA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.plantas.editar(
        planta_id, PlantaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.delete("/plantas/{planta_id}")
async def desactivar_planta(
    planta_id: str,
    request: Request,
    auth: CurrentUser = _CONFIG_PLANTA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.plantas.desactivar(planta_id,         auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "desactivado": True}


# --------------------------------------------------------------- Áreas


class AreaRequest(BaseModel):
    planta_id: str = Field(min_length=1)
    codigo: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=80)
    responsable_id: str | None = None
    activo: bool = True


@router.get("/areas")
async def listar_areas(
    _auth: CurrentUser = _VER_AREA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"areas": await uc.areas.listar()}


@router.get("/areas/{area_id}")
async def ver_area(
    area_id: str,
    _auth: CurrentUser = _VER_AREA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.areas.ver(area_id)


@router.post("/areas")
async def crear_area(
    body: AreaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_AREA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.areas.crear(
        AreaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.put("/areas/{area_id}")
async def editar_area(
    area_id: str,
    body: AreaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_AREA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.areas.editar(
        area_id, AreaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.delete("/areas/{area_id}")
async def desactivar_area(
    area_id: str,
    request: Request,
    auth: CurrentUser = _CONFIG_AREA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.areas.desactivar(area_id,         auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "desactivado": True}


# ------------------------------------------------------------- Máquinas


class MaquinaRequest(BaseModel):
    planta_id: str = Field(min_length=1)
    area_id: str = Field(min_length=1)
    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=80)
    tiene_contador: bool = False
    tipo_contador: str = Field(default="ninguno", pattern="^(ninguno|opc|manual)$")
    velocidad_maxima: float | None = Field(default=None, gt=0)
    config_contador: dict[str, Any] | None = None
    parametros: dict[str, Any] | None = None
    estado_actual_id: str | None = None
    activo: bool = True


@router.get("/maquinas")
async def listar_maquinas(
    _auth: CurrentUser = _VER_MAQUINA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"maquinas": await uc.maquinas.listar()}


@router.get("/maquinas/{maquina_id}")
async def ver_maquina(
    maquina_id: str,
    _auth: CurrentUser = _VER_MAQUINA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.maquinas.ver(maquina_id)


@router.post("/maquinas")
async def crear_maquina(
    body: MaquinaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_MAQUINA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.maquinas.crear(
        MaquinaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.put("/maquinas/{maquina_id}")
async def editar_maquina(
    maquina_id: str,
    body: MaquinaRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_MAQUINA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.maquinas.editar(
        maquina_id, MaquinaDatos(**body.model_dump()),         auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.delete("/maquinas/{maquina_id}")
async def desactivar_maquina(
    maquina_id: str,
    request: Request,
    auth: CurrentUser = _CONFIG_MAQUINA,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.maquinas.desactivar(maquina_id,         auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "desactivado": True}


# --------------------------------------------------------------- Turnos


class TurnoRequest(BaseModel):
    planta_id: str = Field(min_length=1)
    codigo: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=60)
    hora_inicio: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
    hora_fin: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")
    dias_semana: list[int] = Field(min_length=1)
    activo: bool = True


def _turno_datos(body: TurnoRequest) -> TurnoDatos:
    return TurnoDatos(
        planta_id=body.planta_id,
        codigo=body.codigo,
        nombre=body.nombre,
        hora_inicio=_hora(body.hora_inicio),
        hora_fin=_hora(body.hora_fin),
        dias_semana=body.dias_semana,
        activo=body.activo,
    )


def _hora(valor: str) -> time:
    partes = valor.split(":")
    return time(int(partes[0]), int(partes[1]), int(partes[2]) if len(partes) > 2 else 0)


@router.get("/turnos")
async def listar_turnos(
    _auth: CurrentUser = _VER_TURNO,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"turnos": await uc.turnos.listar()}


@router.get("/turnos/{turno_id}")
async def ver_turno(
    turno_id: str,
    _auth: CurrentUser = _VER_TURNO,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.turnos.ver(turno_id)


@router.post("/turnos")
async def crear_turno(
    body: TurnoRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_TURNO,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.turnos.crear(_turno_datos(body), auth.user_id, ip, request_id)
    await _commit(request)
    return result


@router.put("/turnos/{turno_id}")
async def editar_turno(
    turno_id: str,
    body: TurnoRequest,
    request: Request,
    auth: CurrentUser = _CONFIG_TURNO,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.turnos.editar(
        turno_id, _turno_datos(body), auth.user_id, ip, request_id
    )
    await _commit(request)
    return result


@router.delete("/turnos/{turno_id}")
async def desactivar_turno(
    turno_id: str,
    request: Request,
    auth: CurrentUser = _CONFIG_TURNO,
    uc: ConfiguracionUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.turnos.desactivar(turno_id, auth.user_id, ip, request_id)
    await _commit(request)
    return {"ok": True, "desactivado": True}
