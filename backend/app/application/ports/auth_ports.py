"""Puertos (interfaces) del Módulo Autenticación.

El dominio/aplicación define contratos; infrastructure los implementa.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.domain.entities.auth import (
    Rol,
    SesionAutenticacion,
    SesionOperario,
    User,
    UserState,
)
from app.domain.services.turno_service import Turno


class Clock(ABC):
    """Reloj del sistema: única fuente de hora (RN-GEN-001)."""

    @abstractmethod
    def now_utc(self) -> datetime: ...


class TokenService(ABC):
    """Emisión y validación de tokens JWT."""

    @abstractmethod
    def create_access_token(self, subject: str, permisos: list[str]) -> str: ...

    @abstractmethod
    def create_refresh_token(self, subject: str) -> tuple[str, str]: ...

    @abstractmethod
    def create_reset_token(self, subject: str) -> tuple[str, str]: ...

    @abstractmethod
    def decode_token(self, token: str, expected_typ: str) -> dict: ...


class PasswordHasher(ABC):
    """Hashing seguro de contraseñas y PIN (Argon2id)."""

    @abstractmethod
    def hash(self, secret: str) -> str: ...

    @abstractmethod
    def verify(self, secret: str, hashed: str) -> bool: ...


class UserRepository(ABC):
    """Persistencia de usuarios."""

    @abstractmethod
    async def get_by_username(self, usuario: str) -> User | None: ...

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    async def get_by_rfid(self, rfid_tag: str) -> User | None: ...

    @abstractmethod
    async def get_by_qr_secret(self, qr_secret: str) -> User | None: ...

    @abstractmethod
    async def get_by_id(self, user_id: str) -> User | None: ...

    @abstractmethod
    async def get_by_identifier(self, identifier: str) -> User | None:
        """Resuelve un usuario por rfid, qr_secret o usuario (para login con PIN)."""

    @abstractmethod
    async def get_by_codigo(self, codigo: str) -> User | None:
        """Búsqueda por código de empleado (supervisores)."""

    @abstractmethod
    async def update_password_hash(self, user_id: str, password_hash: str) -> None: ...

    @abstractmethod
    async def set_state(self, user_id: str, estado: UserState) -> None: ...

    @abstractmethod
    async def record_failed_login(self, user_id: str) -> int:
        """Incrementa intentos fallidos; devuelve el contador actual."""

    @abstractmethod
    async def reset_login_attempts(self, user_id: str) -> None: ...

    # ---- Administración de usuarios (RBAC) ----

    @abstractmethod
    async def list_all(self) -> list[User]:
        """Todos los usuarios con sus roles (para administración)."""

    @abstractmethod
    async def list_supervisores(self, solo_activos: bool = True) -> list[User]:
        """Usuarios con rol `supervisor` (catálogo para selección en formularios)."""

    @abstractmethod
    async def create(self, user: User) -> User:
        """Crea un usuario; asigna el id generado y lo devuelve."""

    @abstractmethod
    async def update_profile(self, user: User) -> None:
        """Actualiza perfil y asignación (documento, planta, área, máquina, supervisor)."""

    @abstractmethod
    async def replace_roles(self, user_id: str, rol_codigo: str, planta_id: str) -> None:
        """Sustituye los roles del usuario por uno solo (asignación RBAC)."""

    @abstractmethod
    async def get_planta_id_para(self, planta_codigo: str | None) -> str | None:
        """Id de planta válido (FK) para el código de planta asignado."""

    @abstractmethod
    async def delete(self, user_id: str) -> None:
        """Elimina el usuario y sus asignaciones de rol."""


class RolRepository(ABC):
    """Persistencia de roles y permisos."""

    @abstractmethod
    async def get_roles_by_user(self, user_id: str) -> list[Rol]: ...

    @abstractmethod
    async def get_by_codigo(self, codigo: str) -> Rol | None: ...

    @abstractmethod
    async def list_permisos(self) -> list[Any]: ...

    @abstractmethod
    async def list_all(self) -> list[Rol]:
        """Todos los roles del catálogo (para asignación en administración)."""


class KioskoRepository(ABC):
    """Persistencia de kioskos (dispositivos de planta)."""

    @abstractmethod
    async def get_by_token(self, token: str) -> Any | None: ...

    @abstractmethod
    async def get_by_codigo(self, codigo: str) -> Any | None: ...


class TurnoRepository(ABC):
    """Acceso al calendario de turnos de una máquina/planta."""

    @abstractmethod
    async def get_turnos_vigentes(self, planta_id: str) -> list[Turno]: ...


class SesionRepository(ABC):
    """Persistencia de sesiones de autenticación."""

    @abstractmethod
    async def create(
        self,
        usuario_id: str,
        refresh_hash: str,
        expira: datetime,
        ip: str | None,
        dispositivo: str | None,
        jti: str,
    ) -> SesionAutenticacion: ...

    @abstractmethod
    async def get_by_refresh_hash(self, refresh_hash: str) -> SesionAutenticacion | None: ...

    @abstractmethod
    async def revoke(self, sesion_id: str) -> None: ...

    @abstractmethod
    async def revoke_all_for_user(self, usuario_id: str) -> None: ...

    @abstractmethod
    async def list_active_by_user(self, usuario_id: str) -> list[SesionAutenticacion]: ...

    @abstractmethod
    async def get_by_id(self, sesion_id: str) -> SesionAutenticacion | None: ...

    @abstractmethod
    async def revoke_by_jti(self, jti: str) -> None: ...


class SesionOperarioRepository(ABC):
    """Persistencia de sesiones operativas de planta."""

    @abstractmethod
    async def create(self, sesion: SesionOperario) -> SesionOperario: ...

    @abstractmethod
    async def close_active_for_user(self, usuario_id: str, motivo: str) -> None: ...

    @abstractmethod
    async def close_active_for_machine(self, maquina_id: str, motivo: str) -> None: ...

    @abstractmethod
    async def get_active_for_user(self, usuario_id: str) -> SesionOperario | None: ...

    @abstractmethod
    async def get_active_for_machine(self, maquina_id: str) -> SesionOperario | None: ...


class ResetTokenRepository(ABC):
    """Registro de tokens de recuperación usados (single-use por jti)."""

    @abstractmethod
    async def mark_used(self, jti: str) -> bool: ...


class AuditRepository(ABC):
    """Registro de auditoría (RN-AUD-001)."""

    @abstractmethod
    async def record(
        self,
        usuario_id: str | None,
        accion: str,
        modulo: str,
        entidad: str,
        entidad_id: str | None,
        valor_anterior: dict | None,
        valor_nuevo: dict | None,
        ip: str | None,
        dispositivo: str | None,
        request_id: str | None,
    ) -> None: ...

    @abstractmethod
    async def listar(
        self,
        modulo: str | None = None,
        accion: str | None = None,
        usuario_id: str | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Any], int]:
        """Consulta paginada de la bitácora (módulo Auditoría, solo lectura)."""


class EmailSender(ABC):
    """Envío de correos (puerto)."""

    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> None: ...
