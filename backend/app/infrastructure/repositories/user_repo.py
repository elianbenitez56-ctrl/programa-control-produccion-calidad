"""Repositorio SQLAlchemy de usuarios (puerto UserRepository)."""
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.ports.auth_ports import UserRepository
from app.core.exceptions import EntityNotFoundError
from app.domain.entities.auth import User, UserState
from app.infrastructure.orm.configuracion import Planta
from app.infrastructure.orm.identidad import Rol, Usuario, UsuarioRol

LOCKOUT_MINUTES = 15


def _uuid() -> str:
    return str(uuid.uuid4())


def _rol_domain(orm: Rol) -> Any:
    from app.domain.entities.auth import Rol as RolDomain

    return RolDomain(id=orm.id, codigo=orm.codigo, nombre=orm.nombre,
                     es_sistema=orm.es_sistema, permisos=[])


def _to_domain(orm: Usuario) -> User:
    user = User(
        id=orm.id,
        usuario=orm.usuario,
        email=orm.email,
        nombre=orm.nombre,
        apellidos=orm.apellidos,
        estado=UserState(orm.estado),
        pin_hash=orm.pin_hash,
        rfid_tag=orm.rfid_tag,
        qr_secret=orm.qr_secret,
        password_hash=orm.password_hash,
        codigo=orm.codigo,
        documento=orm.documento,
        planta=orm.planta,
        area=orm.area,
        maquina=orm.maquina,
        supervisor=orm.supervisor,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
        extra={
            "intentos_fallidos": orm.intentos_fallidos,
            "bloqueado_hasta": orm.bloqueado_hasta,
            "ultima_conexion": orm.ultima_conexion,
        },
    )
    if orm.roles:
        user.roles = [_rol_domain(r) for r in orm.roles]
    return user


class SqlUserRepository(UserRepository):
    """Implementación de UserRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _get(self, *criteria) -> User | None:
        stmt = select(Usuario).options(selectinload(Usuario.roles)).where(*criteria)
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return _to_domain(orm) if orm else None

    async def get_by_username(self, usuario: str) -> User | None:
        return await self._get(Usuario.usuario == usuario)

    async def get_by_email(self, email: str) -> User | None:
        return await self._get(Usuario.email == email)

    async def get_by_codigo(self, codigo: str) -> User | None:
        return await self._get(Usuario.codigo == codigo)

    async def get_by_rfid(self, rfid_tag: str) -> User | None:
        return await self._get(Usuario.rfid_tag == rfid_tag)

    async def get_by_qr_secret(self, qr_secret: str) -> User | None:
        return await self._get(Usuario.qr_secret == qr_secret)

    async def get_by_id(self, user_id: str) -> User | None:
        return await self._get(Usuario.id == user_id)

    async def get_by_identifier(self, identifier: str) -> User | None:
        for stmt in (
            Usuario.rfid_tag == identifier,
            Usuario.qr_secret == identifier,
            Usuario.usuario == identifier,
        ):
            user = await self._get(stmt)
            if user is not None:
                return user
        return None

    async def update_password_hash(self, user_id: str, password_hash: str) -> None:
        await self.session.execute(
            update(Usuario)
            .where(Usuario.id == user_id)
            .values(password_hash=password_hash, intentos_fallidos=0, bloqueado_hasta=None)
        )

    async def set_state(self, user_id: str, estado: UserState) -> None:
        await self.session.execute(
            update(Usuario).where(Usuario.id == user_id).values(estado=estado.value)
        )

    async def record_failed_login(self, user_id: str) -> int:
        orm = await self.session.get(Usuario, user_id)
        if orm is None:
            return 0
        orm.intentos_fallidos += 1
        if orm.intentos_fallidos >= 5:
            orm.bloqueado_hasta = datetime.now(UTC) + timedelta(minutes=LOCKOUT_MINUTES)
        await self.session.flush()
        return orm.intentos_fallidos

    async def reset_login_attempts(self, user_id: str) -> None:
        await self.session.execute(
            update(Usuario)
            .where(Usuario.id == user_id)
            .values(intentos_fallidos=0, bloqueado_hasta=None, ultima_conexion=datetime.now(UTC))
        )

    # ---- Administración de usuarios (RBAC) ----

    async def list_all(self) -> list[User]:
        stmt = (
            select(Usuario)
            .options(selectinload(Usuario.roles))
            .order_by(Usuario.nombre, Usuario.apellidos)
        )
        result = await self.session.execute(stmt)
        return [_to_domain(orm) for orm in result.scalars().all()]

    async def list_supervisores(self, solo_activos: bool = True) -> list[User]:
        criterios = [Usuario.roles.any(Rol.codigo == "supervisor")]
        if solo_activos:
            criterios.append(Usuario.estado == "activo")
        stmt = (
            select(Usuario)
            .options(selectinload(Usuario.roles))
            .where(*criterios)
            .order_by(Usuario.codigo)
        )
        result = await self.session.execute(stmt)
        return [_to_domain(orm) for orm in result.scalars().all()]

    async def create(self, user: User) -> User:
        orm = Usuario(
            id=_uuid(),
            usuario=user.usuario,
            email=user.email,
            nombre=user.nombre,
            apellidos=user.apellidos,
            codigo=user.codigo,
            documento=user.documento,
            planta=user.planta,
            area=user.area,
            maquina=user.maquina,
            supervisor=user.supervisor,
            password_hash=user.password_hash,
            estado=user.estado.value,
        )
        self.session.add(orm)
        await self.session.flush()
        user.id = orm.id
        user.created_at = orm.created_at
        return user

    async def update_profile(self, user: User) -> None:
        await self.session.execute(
            update(Usuario)
            .where(Usuario.id == user.id)
            .values(
                nombre=user.nombre,
                apellidos=user.apellidos,
                email=user.email,
                codigo=user.codigo,
                documento=user.documento,
                planta=user.planta,
                area=user.area,
                maquina=user.maquina,
                supervisor=user.supervisor,
                estado=user.estado.value,
            )
        )

    async def replace_roles(self, user_id: str, rol_codigo: str, planta_id: str) -> None:
        await self.session.execute(delete(UsuarioRol).where(UsuarioRol.usuario_id == user_id))
        rol = (
            await self.session.execute(select(Rol.id).where(Rol.codigo == rol_codigo))
        ).scalar_one_or_none()
        if rol is None:
            raise EntityNotFoundError("rol")
        self.session.add(
            UsuarioRol(
                id=_uuid(),
                usuario_id=user_id,
                planta_id=planta_id,
                rol_id=rol,
                vigencia_inicio=date.today(),
                vigencia_fin=None,
                activo=True,
            )
        )
        await self.session.flush()

    async def get_planta_id_para(self, planta_codigo: str | None) -> str | None:
        if planta_codigo:
            pid = (
                await self.session.execute(
                    select(Planta.id)
                    .where(func.lower(Planta.codigo) == planta_codigo.strip().lower())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if pid is not None:
                return pid
        return (await self.session.execute(select(Planta.id).limit(1))).scalar_one_or_none()

    async def delete(self, user_id: str) -> None:
        await self.session.execute(delete(UsuarioRol).where(UsuarioRol.usuario_id == user_id))
        await self.session.execute(delete(Usuario).where(Usuario.id == user_id))
