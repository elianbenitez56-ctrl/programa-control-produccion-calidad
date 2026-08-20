"""Repositorios SQLAlchemy de auditoría y tokens de reset (bitacora)."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.auth_ports import AuditRepository, ResetTokenRepository
from app.infrastructure.orm.bitacora import Bitacora


class SqlAuditRepository(AuditRepository):
    """Implementación de AuditRepository: escribe en `bitacora` (RN-AUD-001)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

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
        row = Bitacora(
            usuario_id=usuario_id,
            accion=accion,
            modulo=modulo,
            entidad=entidad,
            entidad_id=entidad_id,
            valor_anterior=valor_anterior,
            valor_nuevo=valor_nuevo,
            ip=ip,
            dispositivo=dispositivo,
        )
        if request_id:
            if row.valor_nuevo is None:
                row.valor_nuevo = {}
            row.valor_nuevo["request_id"] = request_id
        self.session.add(row)
        await self.session.flush()

    async def listar(
        self,
        modulo: str | None = None,
        accion: str | None = None,
        usuario_id: str | None = None,
        fecha_desde: datetime | None = None,
        fecha_hasta: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Bitacora], int]:
        stmt = select(Bitacora)
        if modulo:
            stmt = stmt.where(Bitacora.modulo == modulo)
        if accion:
            stmt = stmt.where(Bitacora.accion == accion)
        if usuario_id:
            stmt = stmt.where(Bitacora.usuario_id == usuario_id)
        if fecha_desde:
            stmt = stmt.where(Bitacora.fecha >= fecha_desde)
        if fecha_hasta:
            stmt = stmt.where(Bitacora.fecha <= fecha_hasta)
        stmt = stmt.order_by(Bitacora.fecha.desc()).offset(offset).limit(limit)

        count_stmt = select(func.count()).select_from(Bitacora)
        if modulo:
            count_stmt = count_stmt.where(Bitacora.modulo == modulo)
        if accion:
            count_stmt = count_stmt.where(Bitacora.accion == accion)
        if usuario_id:
            count_stmt = count_stmt.where(Bitacora.usuario_id == usuario_id)
        if fecha_desde:
            count_stmt = count_stmt.where(Bitacora.fecha >= fecha_desde)
        if fecha_hasta:
            count_stmt = count_stmt.where(Bitacora.fecha <= fecha_hasta)

        result = await self.session.execute(stmt)
        total = (await self.session.execute(count_stmt)).scalar_one()
        return list(result.scalars().all()), int(total)


class SqlResetTokenRepository(ResetTokenRepository):
    """Registro de tokens de reset en `bitacora` (single-use por jti; M1-D1)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def mark_used(self, jti: str) -> bool:
        stmt = (
            select(func.count())
            .select_from(Bitacora)
            .where(Bitacora.accion == "password_reset_usado")
            .where(Bitacora.valor_nuevo["jti"].astext == jti)
        )
        result = await self.session.execute(stmt)
        if result.scalar_one() > 0:
            return False
        self.session.add(
            Bitacora(
                accion="password_reset_usado",
                modulo="auth",
                entidad="token_reset",
                entidad_id=jti,
                valor_nuevo={"jti": jti},
            )
        )
        await self.session.flush()
        return True
