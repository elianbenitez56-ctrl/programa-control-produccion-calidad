"""Endpoints de administración de usuarios (RBAC, solo admin).

Cada endpoint exige el permiso correspondiente mediante `require_permiso`
(middleware de autorización): ver, crear, editar, eliminar.
"""
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, require_permiso
from app.api.use_cases_factory import UsuariosUseCases, _http_meta, build_usuarios_use_cases
from app.application.use_cases.usuarios import UsuarioCrear
from app.core.database import get_db
from app.domain.entities.auth import UserState

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> UsuariosUseCases:
    request.state.db_session = session
    return build_usuarios_use_cases(session)


async def _commit(request: Request) -> None:
    await request.state.db_session.commit()


class UsuarioRequest(BaseModel):
    usuario: str = Field(min_length=4, max_length=60)
    email: str | None = Field(default=None, max_length=150)
    nombre: str = Field(min_length=1, max_length=80)
    apellidos: str = Field(min_length=1, max_length=120)
    codigo: str | None = Field(default=None, max_length=20)
    documento: str | None = Field(default=None, max_length=40)
    rol: str = Field(min_length=1, max_length=40)
    planta: str | None = Field(default=None, max_length=60)
    area: str | None = Field(default=None, max_length=60)
    maquina: str | None = Field(default=None, max_length=60)
    supervisor: str | None = Field(default=None, max_length=120)
    estado: str = Field(default="activo", pattern="^(activo|inactivo)$")


class UsuarioCreateRequest(UsuarioRequest):
    password: str = Field(min_length=8, max_length=200)


class UsuarioUpdateRequest(UsuarioRequest):
    password: str | None = Field(default=None, min_length=8, max_length=200)


class UsuarioEstadoRequest(BaseModel):
    estado: UserState


def _to_datos(body: UsuarioRequest) -> UsuarioCrear:
    return UsuarioCrear(
        usuario=body.usuario,
        email=body.email,
        nombre=body.nombre,
        apellidos=body.apellidos,
        codigo=body.codigo,
        documento=body.documento,
        planta=body.planta,
        area=body.area,
        maquina=body.maquina,
        supervisor=body.supervisor,
        rol=body.rol,
        estado=body.estado,
    )


_ADMIN_VER = Depends(require_permiso("usuario:ver"))
_ADMIN_CREAR = Depends(require_permiso("usuario:crear"))
_ADMIN_EDITAR = Depends(require_permiso("usuario:editar"))
_ADMIN_ELIMINAR = Depends(require_permiso("usuario:eliminar"))
_ADMIN_ROL_VER = Depends(require_permiso("rol:ver"))


@router.get("/roles")
async def listar_roles(
    request: Request,
    _admin: CurrentUser = _ADMIN_ROL_VER,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"roles": await uc.roles.execute()}


@router.get("/supervisores")
async def listar_supervisores(
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    """Catálogo de supervisores (usuarios con rol supervisor) para formularios.

    Visible para cualquier usuario autenticado: los módulos de producción y
    calidad lo usan para seleccionar el supervisor real (código + nombre) en
    lugar de un texto libre. Solo expone datos no sensibles.
    """
    return {"supervisores": await uc.supervisores.execute(solo_activos=True)}


@router.get("")
async def listar_usuarios(
    request: Request,
    _admin: CurrentUser = _ADMIN_VER,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return {"usuarios": await uc.listar.execute()}


@router.get("/{usuario_id}")
async def ver_usuario(
    usuario_id: str,
    request: Request,
    _admin: CurrentUser = _ADMIN_VER,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.ver.execute(usuario_id)


@router.post("")
async def crear_usuario(
    body: UsuarioCreateRequest,
    request: Request,
    _admin: CurrentUser = _ADMIN_CREAR,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.crear.execute(_to_datos(body), body.password, ip, request_id)
    await _commit(request)
    return result


@router.put("/{usuario_id}")
async def editar_usuario(
    usuario_id: str,
    body: UsuarioUpdateRequest,
    request: Request,
    _admin: CurrentUser = _ADMIN_EDITAR,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.editar.execute(usuario_id, _to_datos(body), body.password, ip, request_id)
    await _commit(request)
    return result


@router.patch("/{usuario_id}/estado")
async def cambiar_estado(
    usuario_id: str,
    body: UsuarioEstadoRequest,
    request: Request,
    _admin: CurrentUser = _ADMIN_EDITAR,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    result = await uc.estado.execute(usuario_id, body.estado, ip, request_id)
    await _commit(request)
    return result


@router.delete("/{usuario_id}")
async def eliminar_usuario(
    usuario_id: str,
    request: Request,
    _admin: CurrentUser = _ADMIN_ELIMINAR,
    uc: UsuariosUseCases = Depends(_usecases),
) -> dict[str, Any]:
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.eliminar.execute(usuario_id, ip, request_id)
    await _commit(request)
    return {"ok": True}
