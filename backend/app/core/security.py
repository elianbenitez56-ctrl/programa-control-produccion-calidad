"""Seguridad: hashing Argon2id y emisión/validación de JWT.

No contiene lógica de negocio; es infraestructura pura reemplazable.
"""
import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings
from app.core.exceptions import TokenExpiredError

_hasher = PasswordHasher()


def hash_secret(secret: str) -> str:
    """Genera el hash Argon2id de una contraseña o PIN."""
    return _hasher.hash(secret)


def verify_secret(secret: str, hashed: str) -> bool:
    """Verifica un secreto contra su hash. Devuelve False si no coincide."""
    try:
        return _hasher.verify(hashed, secret)
    except (VerifyMismatchError, InvalidHashError):
        return False


def hash_token(token: str) -> str:
    """Hash SHA-256 de un token (para almacenar refrescos y resets)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(subject: str, permisos: list[str]) -> str:
    """Emite un access token JWT de corta duración."""
    settings = get_settings()
    expire = _now() + timedelta(minutes=settings.jwt_access_expire_minutes)
    payload = {
        "sub": subject,
        "permisos": permisos,
        "jti": str(uuid.uuid4()),
        "typ": "access",
        "iat": _now(),
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> tuple[str, str]:
    """Emite refresh token y devuelve (token, jti). El token se guarda hasheado."""
    settings = get_settings()
    expire = _now() + timedelta(days=settings.jwt_refresh_expire_days)
    jti = str(uuid.uuid4())
    payload = {
        "sub": subject,
        "jti": jti,
        "typ": "refresh",
        "iat": _now(),
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti


def create_reset_token(subject: str) -> tuple[str, str]:
    """Emite token de recuperación de contraseña y devuelve (token, jti)."""
    settings = get_settings()
    expire = _now() + timedelta(minutes=settings.reset_token_expire_minutes)
    jti = str(uuid.uuid4())
    payload = {
        "sub": subject,
        "jti": jti,
        "typ": "pwdreset",
        "iat": _now(),
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti


def decode_token(token: str, expected_typ: str) -> dict:
    """Decodifica y valida un JWT; verifica el tipo esperado."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError() from exc
    except jwt.InvalidTokenError as exc:
        raise TokenExpiredError() from exc
    if payload.get("typ") != expected_typ:
        raise TokenExpiredError()
    return payload
