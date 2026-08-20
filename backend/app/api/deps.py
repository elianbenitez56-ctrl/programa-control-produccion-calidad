"""Dependencias de la API: DB, usuario actual y permisos."""
from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token


@dataclass
class CurrentUser:
    """Usuario identificado por el access token (stateless)."""

    user_id: str
    permisos: list[str]

    def has_permiso(self, codigo: str) -> bool:
        return codigo in self.permisos


def _decode_access(token: str) -> CurrentUser:
    payload = decode_token(token, "access")
    return CurrentUser(user_id=payload["sub"], permisos=list(payload.get("permisos", [])))


def get_current_user(
    authorization: str | None = Header(default=None),
    _session: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthenticationError()
    token = authorization.split(" ", 1)[1]
    return _decode_access(token)


def require_permiso(codigo: str):
    """Fábrica de dependencia: exige un permiso `recurso:accion`."""

    def checker(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current.has_permiso(codigo):
            raise PermissionDeniedError()
        return current

    return checker
