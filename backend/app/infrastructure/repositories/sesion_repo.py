"""Repositorios SQLAlchemy de sesiones (autenticación y operaria)."""
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.auth_ports import SesionOperarioRepository, SesionRepository
from app.domain.entities.auth import LoginMethod, SesionAutenticacion, SesionOperario
from app.infrastructure.orm.identidad import (
    SesionAutenticacion as SesionAutenticacionORM,
)
from app.infrastructure.orm.identidad import SesionOperario as SesionOperarioORM


def _autenticacion_domain(orm: SesionAutenticacionORM) -> SesionAutenticacion:
    return SesionAutenticacion(
        id=orm.id,
        usuario_id=orm.usuario_id,
        token_hash=None,
        refresh_hash=orm.refresh_hash,
        expira=orm.expira,
        revocada=orm.revocada,
        ip=orm.ip,
        dispositivo=orm.dispositivo,
        created_at=orm.created_at,
    )


class SqlSesionRepository(SesionRepository):
    """Implementación de SesionRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        usuario_id: str,
        refresh_hash: str,
        expira: datetime,
        ip: str | None,
        dispositivo: str | None,
        jti: str,
    ) -> SesionAutenticacion:
        orm = SesionAutenticacionORM(
            usuario_id=usuario_id,
            refresh_hash=refresh_hash,
            jti=jti,
            expira=expira,
            ip=ip,
            dispositivo=dispositivo,
            created_at=datetime.now(UTC),
        )
        self.session.add(orm)
        await self.session.flush()
        return _autenticacion_domain(orm)

    async def get_by_refresh_hash(self, refresh_hash: str) -> SesionAutenticacion | None:
        stmt = select(SesionAutenticacionORM).where(
            SesionAutenticacionORM.refresh_hash == refresh_hash
        )
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return _autenticacion_domain(orm) if orm else None

    async def revoke(self, sesion_id: str) -> None:
        await self.session.execute(
            update(SesionAutenticacionORM)
            .where(SesionAutenticacionORM.id == sesion_id)
            .values(revocada=True)
        )

    async def revoke_all_for_user(self, usuario_id: str) -> None:
        await self.session.execute(
            update(SesionAutenticacionORM)
            .where(SesionAutenticacionORM.usuario_id == usuario_id)
            .where(SesionAutenticacionORM.revocada.is_(False))
            .values(revocada=True)
        )

    async def revoke_by_jti(self, jti: str) -> None:
        await self.session.execute(
            update(SesionAutenticacionORM)
            .where(SesionAutenticacionORM.jti == jti)
            .where(SesionAutenticacionORM.revocada.is_(False))
            .values(revocada=True)
        )

    async def list_active_by_user(self, usuario_id: str) -> list[SesionAutenticacion]:
        stmt = (
            select(SesionAutenticacionORM)
            .where(SesionAutenticacionORM.usuario_id == usuario_id)
            .where(SesionAutenticacionORM.revocada.is_(False))
            .order_by(SesionAutenticacionORM.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return [_autenticacion_domain(orm) for orm in result.scalars().all()]

    async def get_by_id(self, sesion_id: str) -> SesionAutenticacion | None:
        orm = await self.session.get(SesionAutenticacionORM, sesion_id)
        return _autenticacion_domain(orm) if orm else None


def _operario_domain(orm: SesionOperarioORM) -> SesionOperario:
    return SesionOperario(
        id=orm.id,
        usuario_id=orm.usuario_id,
        maquina_id=orm.maquina_id,
        turno_id=orm.turno_id,
        kiosko_id=orm.kiosko_id,
        metodo_acceso=LoginMethod(orm.metodo_acceso),
        hora_inicio=orm.hora_inicio,
        hora_fin=orm.hora_fin,
        motivo_cierre=orm.motivo_cierre,
        estado=orm.estado,
        planta_id=orm.planta_id,
    )


class SqlSesionOperarioRepository(SesionOperarioRepository):
    """Implementación de SesionOperarioRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, sesion: SesionOperario) -> SesionOperario:
        orm = SesionOperarioORM(
            planta_id=sesion.planta_id,
            usuario_id=sesion.usuario_id,
            maquina_id=sesion.maquina_id,
            turno_id=sesion.turno_id,
            kiosko_id=sesion.kiosko_id,
            metodo_acceso=sesion.metodo_acceso.value,
            hora_inicio=sesion.hora_inicio,
            hora_fin=sesion.hora_fin,
            motivo_cierre=sesion.motivo_cierre,
            estado=sesion.estado,
        )
        self.session.add(orm)
        await self.session.flush()
        return _operario_domain(orm)

    async def _close(self, *criteria, motivo: str) -> None:
        await self.session.execute(
            update(SesionOperarioORM)
            .where(*criteria)
            .where(SesionOperarioORM.estado == "activa")
            .values(estado="cerrada", hora_fin=datetime.now(UTC), motivo_cierre=motivo)
        )

    async def close_active_for_user(self, usuario_id: str, motivo: str) -> None:
        await self._close(SesionOperarioORM.usuario_id == usuario_id, motivo=motivo)

    async def close_active_for_machine(self, maquina_id: str, motivo: str) -> None:
        await self._close(SesionOperarioORM.maquina_id == maquina_id, motivo=motivo)

    async def get_active_for_user(self, usuario_id: str) -> SesionOperario | None:
        stmt = (
            select(SesionOperarioORM)
            .where(SesionOperarioORM.usuario_id == usuario_id)
            .where(SesionOperarioORM.estado == "activa")
        )
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return _operario_domain(orm) if orm else None

    async def get_active_for_machine(self, maquina_id: str) -> SesionOperario | None:
        stmt = (
            select(SesionOperarioORM)
            .where(SesionOperarioORM.maquina_id == maquina_id)
            .where(SesionOperarioORM.estado == "activa")
        )
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return _operario_domain(orm) if orm else None
