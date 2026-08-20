"""Repositorio SQLAlchemy de turnos (puerto TurnoRepository)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.auth_ports import TurnoRepository
from app.domain.services.turno_service import Turno
from app.infrastructure.orm.configuracion import Turno as TurnoORM
from app.infrastructure.orm.configuracion import TurnoDia


class SqlTurnoRepository(TurnoRepository):
    """Implementación de TurnoRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_turnos_vigentes(self, planta_id: str) -> list[Turno]:
        stmt = (
            select(TurnoORM)
            .where(TurnoORM.planta_id == planta_id)
            .where(TurnoORM.activo.is_(True))
        )
        result = await self.session.execute(stmt)
        turnos_orm = result.scalars().all()
        if not turnos_orm:
            return []

        dias_stmt = select(TurnoDia).where(TurnoDia.turno_id.in_([t.id for t in turnos_orm]))
        dias_result = await self.session.execute(dias_stmt)
        dias: dict[str, set[int]] = {}
        for d in dias_result.scalars().all():
            dias.setdefault(d.turno_id, set()).add(d.dia_semana)

        return [
            Turno(
                id=t.id,
                codigo=t.codigo,
                nombre=t.nombre,
                hora_inicio=t.hora_inicio,
                hora_fin=t.hora_fin,
                dias_semana=frozenset(dias.get(t.id, set())),
            )
            for t in turnos_orm
        ]
