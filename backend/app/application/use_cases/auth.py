"""Casos de uso del Módulo Autenticación.

Contienen la lógica de aplicación (orquestación) y delegans en puertos.
No dependen de FastAPI ni de SQLAlchemy.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.application.ports.auth_ports import (
    AuditRepository,
    Clock,
    EmailSender,
    KioskoRepository,
    PasswordHasher,
    ResetTokenRepository,
    RolRepository,
    SesionOperarioRepository,
    SesionRepository,
    TokenService,
    TurnoRepository,
    UserRepository,
)
from app.application.serializers import usuario_publico
from app.core.config import get_settings
from app.core.exceptions import (
    AccountLockedError,
    AuthenticationError,
    BusinessRuleError,
    EntityNotFoundError,
)
from app.core.security import hash_token
from app.domain.entities.auth import LoginMethod, SesionOperario, UserState
from app.domain.rules.credentials import PasswordPolicy, PinPolicy
from app.domain.services.turno_service import TurnoService

# Umbral de bloqueo por intentos fallidos (config global)
MAX_LOGIN_ATTEMPTS = 5


@dataclass
class TokenPayload:
    """Respuesta con tokens emitidos."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@dataclass
class LoginResult:
    """Resultado de un login exitoso."""

    tokens: TokenPayload
    usuario: dict[str, Any]
    sesion_operario: dict[str, Any] | None = None


class LoginPasswordUseCase:
    """Login con usuario y contraseña (usuarios de gestión)."""

    def __init__(
        self,
        users: UserRepository,
        roles: RolRepository,
        sessions: SesionRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
        audit: AuditRepository,
        clock: Clock,
    ) -> None:
        self.users = users
        self.roles = roles
        self.sessions = sessions
        self.hasher = hasher
        self.tokens = tokens
        self.audit = audit
        self.clock = clock

    async def execute(
        self,
        usuario: str,
        password: str,
        ip: str | None,
        dispositivo: str | None,
        request_id: str | None,
    ) -> LoginResult:
        user = await self.users.get_by_username(usuario)
        if user is None or user.password_hash is None:
            await self.audit.record(
                usuario_id=user.id if user else None,
                accion="login_fallido",
                modulo="auth",
                entidad="usuario",
                entidad_id=user.id if user else None,
                valor_anterior=None,
                valor_nuevo={"usuario": usuario, "motivo": "credenciales_invalidas"},
                ip=ip,
                dispositivo=dispositivo,
                request_id=request_id,
            )
            raise AuthenticationError()

        if not user.is_active():
            raise AuthenticationError()

        bloqueado_hasta = user.extra.get("bloqueado_hasta")
        if bloqueado_hasta and self.clock.now_utc() < bloqueado_hasta:
            raise AccountLockedError()

        if not self.hasher.verify(password, user.password_hash):
            intentos = await self.users.record_failed_login(user.id)
            await self.audit.record(
                user.id,
                "login_fallido",
                "auth",
                "usuario",
                user.id,
                None,
                {"motivo": "password_incorrecta", "intentos": intentos},
                ip,
                dispositivo,
                request_id,
            )
            if intentos >= MAX_LOGIN_ATTEMPTS:
                raise AccountLockedError()
            raise AuthenticationError()

        await self.users.reset_login_attempts(user.id)

        user.roles = await self.roles.get_roles_by_user(user.id)
        permisos = sorted(user.permisos())
        access = self.tokens.create_access_token(user.id, permisos)
        refresh, jti = self.tokens.create_refresh_token(user.id)
        expira = self.clock.now_utc() + self._refresh_ttl()

        await self.sessions.create(
            usuario_id=user.id,
            refresh_hash=hash_token(refresh),
            expira=expira,
            ip=ip,
            dispositivo=dispositivo,
            jti=jti,
        )
        await self.audit.record(
            user.id,
            "login_password",
            "auth",
            "usuario",
            user.id,
            None,
            {"metodo": "password"},
            ip,
            dispositivo,
            request_id,
        )

        result = LoginResult(
            tokens=TokenPayload(access_token=access, refresh_token=refresh),
            usuario=usuario_publico(user, permisos),
        )
        return result

    def _refresh_ttl(self):
        from datetime import timedelta

        return timedelta(days=get_settings().jwt_refresh_expire_days)


@dataclass
class KioskoLoginResult:
    """Resultado de un login por kiosko."""

    access_token: str
    refresh_token: str
    usuario: dict[str, Any]
    sesion_operario: dict[str, Any]


class LoginKioskoUseCase:
    """Login de operario por PIN, QR o RFID desde un kiosko (RN-OPE-001)."""

    def __init__(
        self,
        users: UserRepository,
        roles: RolRepository,
        sessions: SesionRepository,
        op_sessions: SesionOperarioRepository,
        kioskos: KioskoRepository,
        turnos: TurnoRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
        audit: AuditRepository,
        clock: Clock,
    ) -> None:
        self.users = users
        self.roles = roles
        self.sessions = sessions
        self.op_sessions = op_sessions
        self.kioskos = kioskos
        self.turnos = turnos
        self.hasher = hasher
        self.tokens = tokens
        self.audit = audit
        self.clock = clock

    async def execute(
        self,
        metodo: LoginMethod,
        credencial: str,
        kiosko_token: str,
        ip: str | None,
        dispositivo: str | None,
        request_id: str | None,
        identificador: str | None = None,
    ) -> KioskoLoginResult:
        kiosko = await self.kioskos.get_by_token(kiosko_token)
        if kiosko is None:
            raise BusinessRuleError("KIOSKO_INVALIDO")
        maquina_id = kiosko["maquina_id"]
        planta_id = kiosko["planta_id"]
        if not maquina_id:
            raise BusinessRuleError("KIOSKO_SIN_MAQUINA")

        if metodo == LoginMethod.RFID:
            user = await self.users.get_by_rfid(credencial)
            if user and user.rfid_tag != credencial:
                user = None
        elif metodo == LoginMethod.QR:
            user = await self.users.get_by_qr_secret(credencial)
        elif metodo == LoginMethod.PIN:
            # El PIN es un hash Argon2 (no buscable): el usuario se resuelve por
            # `identificador` (rfid/qr/usuario) y el PIN verifica la identidad.
            user = await self.users.get_by_identifier(identificador or "") if identificador else None
        else:
            user = None

        if user is None or not user.is_active():
            await self.audit.record(
                None,
                "kiosko_login_fallido",
                "auth",
                "usuario",
                None,
                None,
                {"metodo": metodo.value, "credencial": credencial[:4]},
                ip,
                dispositivo,
                request_id,
            )
            raise AuthenticationError()

        # Verificación de credencial correspondiente al método.
        if metodo == LoginMethod.PIN:
            if not user.pin_hash or not self.hasher.verify(credencial, user.pin_hash):
                raise AuthenticationError()
        elif metodo == LoginMethod.QR:
            # credencial ya validada por búsqueda por qr_secret.
            pass

        # Turno vigente (RN-TUR-001).
        turnos = await self.turnos.get_turnos_vigentes(planta_id)
        turno = TurnoService.turno_vigente(turnos, self.clock.now_utc())
        turno_id = turno.id if turno else None

        # Una sola sesión operativa activa por usuario y por máquina (RN-OPE-002).
        activa_user = await self.op_sessions.get_active_for_user(user.id)
        if activa_user:
            await self.op_sessions.close_active_for_user(user.id, "reemplazo")
        activa_machine = await self.op_sessions.get_active_for_machine(maquina_id)
        if activa_machine:
            await self.op_sessions.close_active_for_machine(maquina_id, "reemplazo")

        sesion = await self.op_sessions.create(
            SesionOperario(
                id="",
                usuario_id=user.id,
                maquina_id=maquina_id,
                turno_id=turno_id,
                kiosko_id=kiosko["id"],
                metodo_acceso=metodo,
                hora_inicio=self.clock.now_utc(),
                hora_fin=None,
                motivo_cierre=None,
                estado="activa",
                planta_id=planta_id,
            )
        )

        user.roles = await self.roles.get_roles_by_user(user.id)
        permisos = sorted(user.permisos())
        access = self.tokens.create_access_token(user.id, permisos)
        refresh, jti = self.tokens.create_refresh_token(user.id)
        expira = self.clock.now_utc() + timedelta(days=get_settings().jwt_refresh_expire_days)
        await self.sessions.create(user.id, hash_token(refresh), expira, ip, dispositivo, jti)

        await self.audit.record(
            user.id,
            "kiosko_login",
            "auth",
            "sesion_operario",
            sesion.id,
            None,
            {"metodo": metodo, "maquina_id": maquina_id, "turno_id": turno_id},
            ip,
            dispositivo,
            request_id,
        )

        return KioskoLoginResult(
            access_token=access,
            refresh_token=refresh,
            usuario=usuario_publico(user, permisos),
            sesion_operario={
                "id": sesion.id,
                "maquina_id": maquina_id,
                "turno_id": turno_id,
                "metodo_acceso": metodo,
                "hora_inicio": sesion.hora_inicio.isoformat(),
            },
        )


class RefreshTokenUseCase:
    """Rotación de refresh token: revoca el anterior y emite uno nuevo."""

    def __init__(
        self,
        users: UserRepository,
        roles: RolRepository,
        sessions: SesionRepository,
        tokens: TokenService,
        audit: AuditRepository,
        clock: Clock,
    ) -> None:
        self.users = users
        self.roles = roles
        self.sessions = sessions
        self.tokens = tokens
        self.audit = audit
        self.clock = clock

    async def execute(
        self,
        refresh_token: str,
        ip: str | None,
        dispositivo: str | None,
        request_id: str | None,
    ) -> LoginResult:
        payload = self.tokens.decode_token(refresh_token, "refresh")
        jti = payload["jti"]
        subject = payload["sub"]

        sesion = await self.sessions.get_by_refresh_hash(hash_token(refresh_token))
        if sesion is None or sesion.revocada or sesion.expira < self.clock.now_utc():
            raise AuthenticationError("TOKEN_REFRESH_INVALIDO")

        user = await self.users.get_by_id(subject)
        if user is None or not user.is_active():
            raise AuthenticationError()

        user.roles = await self.roles.get_roles_by_user(user.id)
        permisos = sorted(user.permisos())
        access = self.tokens.create_access_token(user.id, permisos)
        new_refresh, new_jti = self.tokens.create_refresh_token(user.id)
        remaining = (
            (sesion.expira - sesion.created_at) if sesion.created_at else timedelta(days=7)
        )
        expira = self.clock.now_utc() + remaining

        await self.sessions.revoke_by_jti(jti)
        await self.sessions.create(user.id, hash_token(new_refresh), expira, ip, dispositivo, new_jti)

        await self.audit.record(
            user.id, "refresh", "auth", "usuario", user.id, {"jti": jti}, {"jti": new_jti}, ip, dispositivo, request_id
        )
        return LoginResult(
            tokens=TokenPayload(access_token=access, refresh_token=new_refresh),
            usuario=usuario_publico(user, permisos),
        )


class LogoutUseCase:
    """Cierra sesión: revoca sesión de autenticación y sesión operativa."""

    def __init__(
        self,
        sessions: SesionRepository,
        op_sessions: SesionOperarioRepository,
        audit: AuditRepository,
    ) -> None:
        self.sessions = sessions
        self.op_sessions = op_sessions
        self.audit = audit

    async def execute(
        self,
        usuario_id: str,
        refresh_hash: str | None,
        ip: str | None,
        dispositivo: str | None,
        request_id: str | None,
    ) -> None:
        if refresh_hash:
            sesion = await self.sessions.get_by_refresh_hash(refresh_hash)
            if sesion:
                await self.sessions.revoke(sesion.id)
        await self.op_sessions.close_active_for_user(usuario_id, "logout")
        await self.audit.record(
            usuario_id, "logout", "auth", "usuario", usuario_id, None, None, ip, dispositivo, request_id
        )


class ChangePasswordUseCase:
    """Cambio de contraseña con verificación de la actual (RN-VAL)."""

    def __init__(
        self,
        users: UserRepository,
        hasher: PasswordHasher,
        sessions: SesionRepository,
        audit: AuditRepository,
    ) -> None:
        self.users = users
        self.hasher = hasher
        self.sessions = sessions
        self.audit = audit

    async def execute(
        self,
        usuario_id: str,
        password_actual: str,
        password_nueva: str,
        ip: str | None,
        request_id: str | None,
    ) -> None:
        failures = PasswordPolicy.validate(password_nueva)
        if failures:
            raise BusinessRuleError("PASSWORD_POLITICA_INVALIDA", details={"reglas": failures})

        user = await self.users.get_by_id(usuario_id)
        if user is None or user.password_hash is None or not self.hasher.verify(password_actual, user.password_hash):
            raise AuthenticationError()

        await self.users.update_password_hash(usuario_id, self.hasher.hash(password_nueva))
        await self.sessions.revoke_all_for_user(usuario_id)
        await self.audit.record(
            usuario_id, "password_cambiada", "auth", "usuario", usuario_id, None, None, ip, None, request_id
        )


class RequestPasswordResetUseCase:
    """Solicitud de recuperación: emite token de uso único de 15 min."""

    def __init__(
        self,
        users: UserRepository,
        tokens: TokenService,
        emails: EmailSender,
        audit: AuditRepository,
    ) -> None:
        self.users = users
        self.tokens = tokens
        self.emails = emails
        self.audit = audit

    async def execute(self, email: str, base_url: str, request_id: str | None) -> None:
        user = await self.users.get_by_email(email)
        # Evita enumeración de emails: respuesta uniforme.
        if user is None or user.email is None:
            return
        token, jti = self.tokens.create_reset_token(user.id)
        await self.audit.record(
            user.id, "password_reset_solicitado", "auth", "usuario", user.id, None, {"jti": jti}, None, None, request_id
        )
        reset_url = f"{base_url}/resetear?token={token}"
        await self.emails.send(
            user.email,
            "Recuperación de contraseña SIGPC",
            f"Para restablecer su contraseña abra: {reset_url}\nEste enlace expira en 15 minutos.",
        )


class ResetPasswordUseCase:
    """Establece nueva contraseña con token de recuperación (single-use)."""

    def __init__(
        self,
        users: UserRepository,
        tokens: TokenService,
        sessions: SesionRepository,
        resets: ResetTokenRepository,
        hasher: PasswordHasher,
        audit: AuditRepository,
    ) -> None:
        self.users = users
        self.tokens = tokens
        self.sessions = sessions
        self.resets = resets
        self.hasher = hasher
        self.audit = audit

    async def execute(
        self,
        token: str,
        password_nueva: str,
        ip: str | None,
        request_id: str | None,
    ) -> None:
        failures = PasswordPolicy.validate(password_nueva)
        if failures:
            raise BusinessRuleError("PASSWORD_POLITICA_INVALIDA", details={"reglas": failures})

        payload = self.tokens.decode_token(token, "pwdreset")
        jti = payload["jti"]
        if not await self.resets.mark_used(jti):
            raise AuthenticationError("PASSWORD_RESET_INVALIDO")

        user = await self.users.get_by_id(payload["sub"])
        if user is None:
            raise EntityNotFoundError("usuario")

        await self.users.update_password_hash(user.id, self.hasher.hash(password_nueva))
        await self.sessions.revoke_all_for_user(user.id)
        await self.audit.record(
            user.id, "password_reset", "auth", "usuario", user.id, None, None, ip, None, request_id
        )


class ListSessionsUseCase:
    """Lista las sesiones activas de un usuario."""

    def __init__(self, sessions: SesionRepository) -> None:
        self.sessions = sessions

    async def execute(self, usuario_id: str) -> list[dict]:
        sesiones = await self.sessions.list_active_by_user(usuario_id)
        return [
            {
                "id": s.id,
                "ip": s.ip,
                "dispositivo": s.dispositivo,
                "creada": s.created_at.isoformat() if s.created_at else None,
                "expira": s.expira.isoformat(),
            }
            for s in sesiones
        ]


class GetMeUseCase:
    """Perfil y permisos del usuario autenticado (GET /auth/me)."""

    def __init__(self, users: UserRepository, roles: RolRepository) -> None:
        self.users = users
        self.roles = roles

    async def execute(self, usuario_id: str) -> dict[str, Any]:
        user = await self.users.get_by_id(usuario_id)
        if user is None:
            raise EntityNotFoundError("usuario")
        user.roles = await self.roles.get_roles_by_user(user.id)
        return usuario_publico(user, sorted(user.permisos()))


class RevokeSessionUseCase:
    """Revoca una sesión específica (gestión de sesiones)."""

    def __init__(self, sessions: SesionRepository, audit: AuditRepository) -> None:
        self.sessions = sessions
        self.audit = audit

    async def execute(self, usuario_id: str, sesion_id: str, request_id: str | None) -> None:
        sesion = await self.sessions.get_by_id(sesion_id)
        if sesion is None or sesion.usuario_id != usuario_id:
            raise EntityNotFoundError("sesion")
        await self.sessions.revoke(sesion_id)
        await self.audit.record(
            usuario_id, "sesion_revocada", "auth", "sesion_autenticacion", sesion_id, None, None, None, None, request_id
        )