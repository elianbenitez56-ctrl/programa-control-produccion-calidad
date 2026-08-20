"""Endpoints del módulo Auditoría (solo lectura de la bitácora).

Cada acción del sistema queda registrada automáticamente en `bitacora`
(RN-AUD-001). Aquí se expone su consulta con filtros y paginación;
no hay escritura ni eliminación en este módulo.
"""
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_permiso
from app.api.use_cases_factory import build_auditoria_use_cases
from app.application.use_cases.auditoria import AuditoriaUseCases
from app.core.database import get_db

router = APIRouter(prefix="/auditoria", tags=["auditoria"])

_CONSULTAR = Depends(require_permiso("auditoria:consultar"))


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> AuditoriaUseCases:
    request.state.db_session = session
    return build_auditoria_use_cases(session)


def _dt(valor: str | None) -> datetime | None:
    if not valor:
        return None
    dt = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.get("")
async def listar_auditoria(
    modulo: str | None = Query(default=None),
    accion: str | None = Query(default=None),
    usuario_id: str | None = Query(default=None),
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _auth: CurrentUser = _CONSULTAR,
    uc: AuditoriaUseCases = Depends(_usecases),
) -> dict[str, Any]:
    return await uc.listar(
        modulo=modulo, accion=accion, usuario_id=usuario_id,
        fecha_desde=_dt(fecha_desde), fecha_hasta=_dt(fecha_hasta),
        limit=limit, offset=offset,
    )
