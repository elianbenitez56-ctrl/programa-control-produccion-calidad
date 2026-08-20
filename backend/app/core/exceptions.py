"""Jerarquía de excepciones del sistema SIGPC.

Los errores de dominio llevan un `code` internacionalizable (i18n) y una
carga `details` opcional. La API los traduce a la respuesta estándar:
`{"error": {"code", "message", "details", "request_id"}}`.
"""

from typing import Any


class DomainError(Exception):
    """Error base del dominio de negocio."""

    code = "ERROR_DOMINIO"
    http_status = 400

    def __init__(
        self,
        code: str | None = None,
        message: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or code or self.code)
        self.code = code or self.code
        self.message = message or self.code
        self.details = details or {}


class BusinessRuleError(DomainError):
    """Violación de una regla de negocio (RN). HTTP 409/422 según contexto."""

    code = "REGLA_DE_NEGOCIO"
    http_status = 409


class AuthenticationError(DomainError):
    """Credenciales inválidas o token no válido."""

    code = "AUTENTICACION_INVALIDA"
    http_status = 401


class PermissionDeniedError(DomainError):
    """El usuario no tiene el permiso requerido."""

    code = "PERMISO_DENEGADO"
    http_status = 403


class EntityNotFoundError(DomainError):
    """La entidad solicitada no existe."""

    code = "ENTIDAD_NO_ENCONTRADA"
    http_status = 404


class ConflictError(DomainError):
    """Conflicto de estado (transición inválida, duplicado)."""

    code = "CONFLICTO"
    http_status = 409


class TokenExpiredError(AuthenticationError):
    """El token (access o refresh) expiró."""

    code = "TOKEN_EXPIRADO"


class AccountLockedError(AuthenticationError):
    """Cuenta bloqueada por intentos fallidos."""

    code = "CUENTA_BLOQUEADA"


class InvalidStateError(ConflictError):
    """Transición de estado no permitida para la entidad."""

    code = "TRANSICION_NO_PERMITIDA"
