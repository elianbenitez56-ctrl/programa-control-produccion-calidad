"""Implementaciones de TokenService y PasswordHasher (puertos).

Envuelven las funciones puras de app.core.security.
"""
from datetime import datetime
from typing import Any

from app.application.ports.auth_ports import PasswordHasher, TokenService
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_secret,
    verify_secret,
)


class JwtTokenService(TokenService):
    """Emisión y validación JWT vía app.core.security."""

    def create_access_token(self, subject: str, permisos: list[str]) -> str:
        return create_access_token(subject, permisos)

    def create_refresh_token(self, subject: str) -> tuple[str, str]:
        return create_refresh_token(subject)

    def create_reset_token(self, subject: str) -> tuple[str, str]:
        return create_reset_token(subject)

    def decode_token(self, token: str, expected_typ: str) -> dict:
        return decode_token(token, expected_typ)


class Argon2PasswordHasher(PasswordHasher):
    """Hashing Argon2id vía app.core.security."""

    def hash(self, secret: str) -> str:
        return hash_secret(secret)

    def verify(self, secret: str, hashed: str) -> bool:
        return verify_secret(secret, hashed)
