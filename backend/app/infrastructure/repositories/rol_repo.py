"""Repositorio SQLAlchemy de roles y permisos (puerto RolRepository)."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.ports.auth_ports import RolRepository
from app.domain.entities.auth import Permiso, Rol
from app.infrastructure.orm.identidad import Permiso as PermisoORM
from app.infrastructure.orm.identidad import Rol as RolORM
from app.infrastructure.orm.identidad import UsuarioRol


def _rol_domain(orm: RolORM) -> Rol:
    return Rol(
        id=orm.id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        es_sistema=orm.es_sistema,
        permisos=[_permiso_domain(p) for p in orm.permisos],
    )


def _permiso_domain(orm: PermisoORM) -> Permiso:
    return Permiso(id=orm.id, codigo=orm.codigo, modulo=orm.modulo,
                   recurso=orm.recurso, accion=orm.accion)


class SqlRolRepository(RolRepository):
    """Implementación de RolRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_roles_by_user(self, user_id: str) -> list[Rol]:
        hoy = func.current_date()
        stmt = (
            select(RolORM)
            .join(UsuarioRol, UsuarioRol.rol_id == RolORM.id)
            .options(selectinload(RolORM.permisos))
            .where(UsuarioRol.usuario_id == user_id)
            .where(UsuarioRol.activo.is_(True))
            .where(UsuarioRol.vigencia_inicio <= hoy)
            .where(
                (UsuarioRol.vigencia_fin.is_(None)) | (UsuarioRol.vigencia_fin >= hoy)
            )
        )
        result = await self.session.execute(stmt)
        return [_rol_domain(orm) for orm in result.scalars().all()]

    async def get_by_codigo(self, codigo: str) -> Rol | None:
        stmt = (
            select(RolORM)
            .options(selectinload(RolORM.permisos))
            .where(RolORM.codigo == codigo)
        )
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return _rol_domain(orm) if orm else None

    async def list_permisos(self) -> list[Permiso]:
        stmt = select(PermisoORM).order_by(PermisoORM.codigo)
        result = await self.session.execute(stmt)
        return [_permiso_domain(orm) for orm in result.scalars().all()]

    async def list_all(self) -> list[Rol]:
        stmt = select(RolORM).options(selectinload(RolORM.permisos)).order_by(RolORM.codigo)
        result = await self.session.execute(stmt)
        return [_rol_domain(orm) for orm in result.scalars().all()]
