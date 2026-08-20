"""Repositorios SQLAlchemy del Módulo Configuración.

Implementan los puertos `PlantaRepository`, `AreaRepository`,
`MaquinaRepository` y `TurnoRepository` sobre AsyncSession.
"""
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.configuracion_ports import (
    AreaRepository,
    MaquinaRepository,
    PlantaRepository,
    TurnoRepository,
)
from app.domain.entities.configuracion import Area, Maquina, Planta, Turno
from app.infrastructure.orm.configuracion import (
    Area as AreaORM,
)
from app.infrastructure.orm.configuracion import (
    Estado,
    TurnoDia,
)
from app.infrastructure.orm.configuracion import (
    Maquina as MaquinaORM,
)
from app.infrastructure.orm.configuracion import (
    Planta as PlantaORM,
)
from app.infrastructure.orm.configuracion import (
    Turno as TurnoORM,
)


def _uuid() -> str:
    return str(uuid.uuid4())


def _planta_domain(orm: PlantaORM) -> Planta:
    return Planta(
        id=orm.id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        pais=orm.pais,
        zona_horaria=orm.zona_horaria,
        idioma=orm.idioma,
        activo=orm.activo,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _area_domain(orm: AreaORM) -> Area:
    return Area(
        id=orm.id,
        planta_id=orm.planta_id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        responsable_id=orm.responsable_id,
        activo=orm.activo,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _maquina_domain(orm: MaquinaORM) -> Maquina:
    return Maquina(
        id=orm.id,
        planta_id=orm.planta_id,
        area_id=orm.area_id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        tiene_contador=orm.tiene_contador,
        tipo_contador=orm.tipo_contador,
        velocidad_maxima=float(orm.velocidad_maxima) if orm.velocidad_maxima is not None else None,
        config_contador=orm.config_contador,
        parametros=orm.parametros,
        estado_actual_id=orm.estado_actual_id,
        activo=orm.activo,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _turno_domain(orm: TurnoORM, dias: list[int] | None = None) -> Turno:
    return Turno(
        id=orm.id,
        planta_id=orm.planta_id,
        codigo=orm.codigo,
        nombre=orm.nombre,
        hora_inicio=orm.hora_inicio,
        hora_fin=orm.hora_fin,
        activo=orm.activo,
        dias_semana=dias or [],
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


class SqlPlantaRepository(PlantaRepository):
    """Implementación de PlantaRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[Planta]:
        result = await self.session.execute(
            select(PlantaORM).order_by(PlantaORM.codigo)
        )
        return [_planta_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, planta_id: str) -> Planta | None:
        orm = await self.session.get(PlantaORM, planta_id)
        return _planta_domain(orm) if orm else None

    async def get_by_codigo(self, codigo: str) -> Planta | None:
        result = await self.session.execute(
            select(PlantaORM).where(func.lower(PlantaORM.codigo) == codigo.strip().lower())
        )
        orm = result.scalar_one_or_none()
        return _planta_domain(orm) if orm else None

    async def create(self, planta: Planta) -> Planta:
        orm = PlantaORM(
            id=_uuid(),
            codigo=planta.codigo,
            nombre=planta.nombre,
            pais=planta.pais,
            zona_horaria=planta.zona_horaria,
            idioma=planta.idioma,
            activo=planta.activo,
        )
        self.session.add(orm)
        await self.session.flush()
        return _planta_domain(orm)

    async def update(self, planta: Planta) -> None:
        orm = await self.session.get(PlantaORM, planta.id)
        if orm is None:
            return
        orm.codigo = planta.codigo
        orm.nombre = planta.nombre
        orm.pais = planta.pais
        orm.zona_horaria = planta.zona_horaria
        orm.idioma = planta.idioma
        orm.activo = planta.activo
        await self.session.flush()

    async def set_activo(self, planta_id: str, activo: bool) -> None:
        orm = await self.session.get(PlantaORM, planta_id)
        if orm is None:
            return
        orm.activo = activo
        await self.session.flush()


class SqlAreaRepository(AreaRepository):
    """Implementación de AreaRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[Area]:
        result = await self.session.execute(
            select(AreaORM).order_by(AreaORM.codigo)
        )
        return [_area_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, area_id: str) -> Area | None:
        orm = await self.session.get(AreaORM, area_id)
        return _area_domain(orm) if orm else None

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Area | None:
        result = await self.session.execute(
            select(AreaORM)
            .where(AreaORM.planta_id == planta_id)
            .where(func.lower(AreaORM.codigo) == codigo.strip().lower())
        )
        orm = result.scalar_one_or_none()
        return _area_domain(orm) if orm else None

    async def create(self, area: Area) -> Area:
        orm = AreaORM(
            id=_uuid(),
            planta_id=area.planta_id,
            codigo=area.codigo,
            nombre=area.nombre,
            responsable_id=area.responsable_id,
            activo=area.activo,
        )
        self.session.add(orm)
        await self.session.flush()
        return _area_domain(orm)

    async def update(self, area: Area) -> None:
        orm = await self.session.get(AreaORM, area.id)
        if orm is None:
            return
        orm.planta_id = area.planta_id
        orm.codigo = area.codigo
        orm.nombre = area.nombre
        orm.responsable_id = area.responsable_id
        orm.activo = area.activo
        await self.session.flush()

    async def set_activo(self, area_id: str, activo: bool) -> None:
        orm = await self.session.get(AreaORM, area_id)
        if orm is None:
            return
        orm.activo = activo
        await self.session.flush()


class SqlMaquinaRepository(MaquinaRepository):
    """Implementación de MaquinaRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[Maquina]:
        result = await self.session.execute(
            select(MaquinaORM).order_by(MaquinaORM.codigo)
        )
        return [_maquina_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, maquina_id: str) -> Maquina | None:
        orm = await self.session.get(MaquinaORM, maquina_id)
        return _maquina_domain(orm) if orm else None

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Maquina | None:
        result = await self.session.execute(
            select(MaquinaORM)
            .where(MaquinaORM.planta_id == planta_id)
            .where(func.lower(MaquinaORM.codigo) == codigo.strip().lower())
        )
        orm = result.scalar_one_or_none()
        return _maquina_domain(orm) if orm else None

    async def estado_inicial_por_defecto(self) -> str | None:
        result = await self.session.execute(
            select(Estado.id)
            .where(Estado.proceso == "maquina")
            .where(func.lower(Estado.codigo) == "lista")
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(self, maquina: Maquina) -> Maquina:
        orm = MaquinaORM(
            id=_uuid(),
            planta_id=maquina.planta_id,
            area_id=maquina.area_id,
            codigo=maquina.codigo,
            nombre=maquina.nombre,
            tiene_contador=maquina.tiene_contador,
            tipo_contador=maquina.tipo_contador,
            velocidad_maxima=maquina.velocidad_maxima,
            config_contador=maquina.config_contador,
            parametros=maquina.parametros,
            estado_actual_id=maquina.estado_actual_id,
            activo=maquina.activo,
        )
        self.session.add(orm)
        await self.session.flush()
        return _maquina_domain(orm)

    async def update(self, maquina: Maquina) -> None:
        orm = await self.session.get(MaquinaORM, maquina.id)
        if orm is None:
            return
        orm.planta_id = maquina.planta_id
        orm.area_id = maquina.area_id
        orm.codigo = maquina.codigo
        orm.nombre = maquina.nombre
        orm.tiene_contador = maquina.tiene_contador
        orm.tipo_contador = maquina.tipo_contador
        orm.velocidad_maxima = maquina.velocidad_maxima
        orm.config_contador = maquina.config_contador
        orm.parametros = maquina.parametros
        orm.estado_actual_id = maquina.estado_actual_id
        orm.activo = maquina.activo
        await self.session.flush()

    async def set_activo(self, maquina_id: str, activo: bool) -> None:
        orm = await self.session.get(MaquinaORM, maquina_id)
        if orm is None:
            return
        orm.activo = activo
        await self.session.flush()


class SqlTurnoRepository(TurnoRepository):
    """Implementación de TurnoRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _dias_para(self, turno_id: str) -> list[int]:
        result = await self.session.execute(
            select(TurnoDia.dia_semana)
            .where(TurnoDia.turno_id == turno_id)
            .order_by(TurnoDia.dia_semana)
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Turno]:
        result = await self.session.execute(
            select(TurnoORM).order_by(TurnoORM.codigo)
        )
        turnos = [_turno_domain(o) for o in result.scalars().all()]
        for turno in turnos:
            turno.dias_semana = await self._dias_para(turno.id)
        return turnos

    async def get_by_id(self, turno_id: str) -> Turno | None:
        orm = await self.session.get(TurnoORM, turno_id)
        if orm is None:
            return None
        turno = _turno_domain(orm)
        turno.dias_semana = await self._dias_para(turno.id)
        return turno

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Turno | None:
        result = await self.session.execute(
            select(TurnoORM)
            .where(TurnoORM.planta_id == planta_id)
            .where(func.lower(TurnoORM.codigo) == codigo.strip().lower())
        )
        orm = result.scalar_one_or_none()
        if orm is None:
            return None
        turno = _turno_domain(orm)
        turno.dias_semana = await self._dias_para(turno.id)
        return turno

    async def create(self, turno: Turno) -> Turno:
        orm = TurnoORM(
            id=_uuid(),
            planta_id=turno.planta_id,
            codigo=turno.codigo,
            nombre=turno.nombre,
            hora_inicio=turno.hora_inicio,
            hora_fin=turno.hora_fin,
            activo=turno.activo,
        )
        self.session.add(orm)
        await self.session.flush()
        await self._replace_dias(orm.id, turno.dias_semana)
        return _turno_domain(orm, dias=turno.dias_semana)

    async def update(self, turno: Turno) -> None:
        orm = await self.session.get(TurnoORM, turno.id)
        if orm is None:
            return
        orm.planta_id = turno.planta_id
        orm.codigo = turno.codigo
        orm.nombre = turno.nombre
        orm.hora_inicio = turno.hora_inicio
        orm.hora_fin = turno.hora_fin
        orm.activo = turno.activo
        await self.session.flush()
        await self._replace_dias(turno.id, turno.dias_semana)

    async def _replace_dias(self, turno_id: str, dias: list[int]) -> None:
        await self.session.execute(delete(TurnoDia).where(TurnoDia.turno_id == turno_id))
        for dia in sorted(set(dias)):
            self.session.add(
                TurnoDia(id=_uuid(), turno_id=turno_id, dia_semana=dia)
            )
        await self.session.flush()

    async def set_activo(self, turno_id: str, activo: bool) -> None:
        orm = await self.session.get(TurnoORM, turno_id)
        if orm is None:
            return
        orm.activo = activo
        await self.session.flush()
