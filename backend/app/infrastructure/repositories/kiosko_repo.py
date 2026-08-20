"""Repositorio SQLAlchemy de kioskos (puerto KioskoRepository)."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.auth_ports import KioskoRepository
from app.infrastructure.orm.configuracion import Kiosko as KioskoORM


class SqlKioskoRepository(KioskoRepository):
    """Implementación de KioskoRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _get(self, *criteria) -> dict[str, Any] | None:
        stmt = select(KioskoORM).where(*criteria).where(KioskoORM.activo.is_(True))
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm is None:
            return None
        return {
            "id": orm.id,
            "planta_id": orm.planta_id,
            "maquina_id": orm.maquina_id,
            "codigo": orm.codigo,
            "tipo_ingreso": orm.tipo_ingreso,
        }

    async def get_by_token(self, token: str) -> Any | None:
        return await self._get(KioskoORM.token_dispositivo == token)

    async def get_by_codigo(self, codigo: str) -> Any | None:
        return await self._get(KioskoORM.codigo == codigo)
