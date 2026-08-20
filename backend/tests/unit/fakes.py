"""Fakes en memoria para pruebas unitarias de los casos de uso."""
from datetime import UTC, datetime, timedelta
from typing import Any

from app.application.ports.auth_ports import (
    AuditRepository,
    Clock,
    KioskoRepository,
    ResetTokenRepository,
    RolRepository,
    SesionOperarioRepository,
    SesionRepository,
    TurnoRepository,
    UserRepository,
)
from app.domain.entities.auth import (
    Permiso,
    Rol,
    SesionAutenticacion,
    SesionOperario,
    User,
    UserState,
)
from app.domain.services.turno_service import Turno


class FakeClock(Clock):
    def __init__(self, ahora: datetime | None = None) -> None:
        self.ahora = ahora or datetime.now(UTC)

    def now_utc(self) -> datetime:
        return self.ahora


class FakeUserRepository(UserRepository):
    def __init__(self, users: list[User] | None = None) -> None:
        self.users = {u.id: u for u in (users or [])}

    def add(self, user: User) -> None:
        self.users[user.id] = user

    def _find(self, predicate) -> User | None:
        for u in self.users.values():
            if predicate(u):
                return u
        return None

    async def get_by_username(self, usuario: str) -> User | None:
        return self._find(lambda u: u.usuario == usuario)

    async def get_by_email(self, email: str) -> User | None:
        return self._find(lambda u: u.email == email)

    async def get_by_codigo(self, codigo: str) -> User | None:
        return self._find(lambda u: u.codigo == codigo)

    async def get_by_rfid(self, rfid_tag: str) -> User | None:
        return self._find(lambda u: u.rfid_tag == rfid_tag)

    async def get_by_qr_secret(self, qr_secret: str) -> User | None:
        return self._find(lambda u: u.qr_secret == qr_secret)

    async def get_by_id(self, user_id: str) -> User | None:
        return self.users.get(user_id)

    async def get_by_identifier(self, identifier: str) -> User | None:
        return self._find(
            lambda u: u.rfid_tag == identifier
            or u.qr_secret == identifier
            or u.usuario == identifier
        )

    async def update_password_hash(self, user_id: str, password_hash: str) -> None:
        self.users[user_id].password_hash = password_hash

    async def set_state(self, user_id: str, estado: UserState) -> None:
        self.users[user_id].estado = estado

    async def record_failed_login(self, user_id: str) -> int:
        u = self.users[user_id]
        intentos = u.extra.get("intentos_fallidos", 0) + 1
        u.extra["intentos_fallidos"] = intentos
        if intentos >= 5:
            u.extra["bloqueado_hasta"] = datetime.now(UTC) + timedelta(minutes=15)
        return intentos

    async def reset_login_attempts(self, user_id: str) -> None:
        u = self.users[user_id]
        u.extra.pop("intentos_fallidos", None)
        u.extra.pop("bloqueado_hasta", None)

    # ---- Administración de usuarios (RBAC) ----

    async def list_all(self) -> list[User]:
        return list(self.users.values())

    async def list_supervisores(self, solo_activos: bool = True) -> list[User]:
        return [
            u for u in self.users.values()
            if u.has_role("supervisor") and (not solo_activos or u.is_active())
        ]

    async def create(self, user: User) -> User:
        user.id = user.id or f"u-{len(self.users) + 1}"
        self.add(user)
        return user

    async def update_profile(self, user: User) -> None:
        self.users[user.id] = user

    async def replace_roles(self, user_id: str, rol_codigo: str, planta_id: str) -> None:
        u = self.users[user_id]
        u.roles = [fake_rol(rol_codigo)]

    async def get_planta_id_para(self, planta_codigo: str | None) -> str | None:
        return planta_codigo or "planta-1"

    async def delete(self, user_id: str) -> None:
        self.users.pop(user_id, None)


def fake_user(
    *,
    id: str = "u-1",
    usuario: str = "admin",
    email: str | None = None,
    password_hash: str | None = None,
    pin_hash: str | None = None,
    rfid_tag: str | None = None,
    qr_secret: str | None = None,
    estado: UserState = UserState.ACTIVO,
) -> User:
    return User(
        id=id,
        usuario=usuario,
        email=email if email is not None else f"{usuario}@sigpc.local",
        nombre="Demo",
        apellidos="User",
        estado=estado,
        password_hash=password_hash,
        pin_hash=pin_hash,
        rfid_tag=rfid_tag,
        qr_secret=qr_secret,
        roles=[],
        extra={},
    )


class FakeRolRepository(RolRepository):
    def __init__(self) -> None:
        self.roles_por_user: dict[str, list[Rol]] = {}

    def set_roles(self, user_id: str, roles: list[Rol]) -> None:
        self.roles_por_user[user_id] = roles

    async def get_roles_by_user(self, user_id: str) -> list[Rol]:
        return self.roles_por_user.get(user_id, [])

    async def get_by_codigo(self, codigo: str) -> Rol | None:
        for roles in self.roles_por_user.values():
            for r in roles:
                if r.codigo == codigo:
                    return r
        return None

    async def list_permisos(self) -> list[Any]:
        permisos: set[Permiso] = set()
        for roles in self.roles_por_user.values():
            for rol in roles:
                permisos.update(rol.permisos)
        return list(permisos)

    async def list_all(self) -> list[Rol]:
        vistos: dict[str, Rol] = {}
        for roles in self.roles_por_user.values():
            for rol in roles:
                vistos[rol.codigo] = rol
        return list(vistos.values())


def fake_rol(codigo: str, *permisos: str) -> Rol:
    return Rol(
        id=f"r-{codigo}",
        codigo=codigo,
        nombre=codigo,
        permisos=[
            Permiso(id=f"p-{p}", codigo=p, modulo="x", recurso=p.split(":")[0], accion="x")
            for p in permisos
        ],
    )


class FakeSesionRepository(SesionRepository):
    """Sesiones de autenticación en memoria."""

    def __init__(self) -> None:
        self.auth: list[SesionAutenticacion] = []
        self.jti_a_sesion: dict[str, str] = {}
        self.seq = 0

    async def create(
        self,
        usuario_id: str,
        refresh_hash: str,
        expira: datetime,
        ip: str | None,
        dispositivo: str | None,
        jti: str,
    ) -> SesionAutenticacion:
        self.seq += 1
        s = SesionAutenticacion(
            id=f"sa-{self.seq}",
            usuario_id=usuario_id,
            token_hash=None,
            refresh_hash=refresh_hash,
            expira=expira,
            revocada=False,
            ip=ip,
            dispositivo=dispositivo,
            created_at=datetime.now(UTC),
        )
        self.auth.append(s)
        self.jti_a_sesion[jti] = s.id
        return s

    async def get_by_refresh_hash(self, refresh_hash: str) -> SesionAutenticacion | None:
        return next((s for s in self.auth if s.refresh_hash == refresh_hash), None)

    async def revoke(self, sesion_id: str) -> None:
        s = self.get_by_id_sync(sesion_id)
        if s:
            s.revocada = True

    async def revoke_all_for_user(self, usuario_id: str) -> None:
        for s in self.auth:
            if s.usuario_id == usuario_id:
                s.revocada = True

    async def revoke_by_jti(self, jti: str) -> None:
        sesion_id = self.jti_a_sesion.get(jti)
        if sesion_id:
            await self.revoke(sesion_id)

    async def list_active_by_user(self, usuario_id: str) -> list[SesionAutenticacion]:
        return [
            s for s in self.auth if s.usuario_id == usuario_id and not s.revocada
        ]

    async def get_by_id(self, sesion_id: str) -> SesionAutenticacion | None:
        return self.get_by_id_sync(sesion_id)

    def get_by_id_sync(self, sesion_id: str) -> SesionAutenticacion | None:
        return next((s for s in self.auth if s.id == sesion_id), None)


class FakeSesionOperarioRepository(SesionOperarioRepository):
    """Sesiones operarias en memoria."""

    def __init__(self) -> None:
        self.op: list[SesionOperario] = []
        self.seq = 0

    async def create(self, sesion: SesionOperario) -> SesionOperario:
        self.seq += 1
        sesion.id = f"so-{self.seq}"
        self.op.append(sesion)
        return sesion

    async def close_active_for_user(self, usuario_id: str, motivo: str) -> None:
        for s in self.op:
            if s.usuario_id == usuario_id and s.estado == "activa":
                s.estado = "cerrada"
                s.hora_fin = datetime.now(UTC)
                s.motivo_cierre = motivo

    async def close_active_for_machine(self, maquina_id: str, motivo: str) -> None:
        for s in self.op:
            if s.maquina_id == maquina_id and s.estado == "activa":
                s.estado = "cerrada"
                s.hora_fin = datetime.now(UTC)
                s.motivo_cierre = motivo

    async def get_active_for_user(self, usuario_id: str) -> SesionOperario | None:
        return next(
            (s for s in self.op if s.usuario_id == usuario_id and s.estado == "activa"), None
        )

    async def get_active_for_machine(self, maquina_id: str) -> SesionOperario | None:
        return next(
            (s for s in self.op if s.maquina_id == maquina_id and s.estado == "activa"), None
        )


class FakeKioskoRepository(KioskoRepository):
    def __init__(self, kioskos: list[dict] | None = None) -> None:
        self.kioskos = kioskos or []

    def add(self, kiosko: dict) -> None:
        self.kioskos.append(kiosko)

    async def get_by_token(self, token: str) -> dict | None:
        return next((k for k in self.kioskos if k["token"] == token), None)

    async def get_by_codigo(self, codigo: str) -> dict | None:
        return next((k for k in self.kioskos if k["codigo"] == codigo), None)


class FakeTurnoRepository(TurnoRepository):
    def __init__(self, turnos: list[Turno] | None = None) -> None:
        self.turnos = turnos or []

    async def get_turnos_vigentes(self, planta_id: str) -> list[Turno]:
        return self.turnos


class FakeAuditRepository(AuditRepository):
    def __init__(self) -> None:
        self.rows: list[dict] = []

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
    ) -> None:
        self.rows.append({
            "usuario_id": usuario_id,
            "accion": accion,
            "modulo": modulo,
            "entidad": entidad,
            "entidad_id": entidad_id,
            "valor_anterior": valor_anterior,
            "valor_nuevo": valor_nuevo,
            "ip": ip,
            "dispositivo": dispositivo,
            "request_id": request_id,
        })

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
        filas = [
            r for r in self.rows
            if (modulo is None or r.get("modulo") == modulo)
            and (accion is None or r.get("accion") == accion)
            and (usuario_id is None or r.get("usuario_id") == usuario_id)
        ]
        return filas[offset : offset + limit], len(filas)


class FakeResetTokenRepository(ResetTokenRepository):
    def __init__(self) -> None:
        self.usados: set[str] = set()

    async def mark_used(self, jti: str) -> bool:
        if jti in self.usados:
            return False
        self.usados.add(jti)
        return True
