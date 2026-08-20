"""Repositorios SQLAlchemy del módulo Producción.

Implementan los puertos de producción sobre AsyncSession, incluida la
agregación `totales` que alimenta Dashboard, Reportes e Indicadores.
"""
import uuid
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.produccion_ports import (
    CalidadRepository,
    OrdenProduccionRepository,
    ParadaRepository,
    RegistroDiarioRepository,
)
from app.domain.entities.produccion import (
    IncidenciaCalidad,
    OrdenProduccion,
    Parada,
    RegistroDiario,
)
from app.infrastructure.orm.produccion import (
    IncidenciaCalidad as IncidenciaCalidadORM,
)
from app.infrastructure.orm.produccion import (
    OrdenProduccion as OrdenProduccionORM,
)
from app.infrastructure.orm.produccion import (
    Parada as ParadaORM,
)
from app.infrastructure.orm.produccion import (
    RegistroDiario as RegistroDiarioORM,
)


def _uuid() -> str:
    return str(uuid.uuid4())


def _orden_domain(orm: OrdenProduccionORM) -> OrdenProduccion:
    return OrdenProduccion(
        id=orm.id,
        numero_op=orm.numero_op,
        cliente=orm.cliente,
        producto=orm.producto,
        descripcion=orm.descripcion,
        unidad=orm.unidad,
        cantidad_planificada=float(orm.cantidad_planificada)
        if orm.cantidad_planificada is not None else None,
        cantidad_producida=float(orm.cantidad_producida),
        prioridad=orm.prioridad,
        estado=orm.estado,
        fecha_emision=orm.fecha_emision,
        fecha_programada=orm.fecha_programada,
        fecha_fin_estimada=orm.fecha_fin_estimada,
        planta_id=orm.planta_id,
        area_id=orm.area_id,
        maquina_id=orm.maquina_id,
        operario_id=orm.operario_id,
        turno_id=orm.turno_id,
        fecha_inicio=orm.fecha_inicio,
        fecha_fin=orm.fecha_fin,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _registro_domain(orm: RegistroDiarioORM) -> RegistroDiario:
    return RegistroDiario(
        id=orm.id,
        op_id=orm.op_id,
        fecha=orm.fecha,
        turno_id=orm.turno_id,
        operario_id=orm.operario_id,
        planta_id=orm.planta_id,
        area_id=orm.area_id,
        maquina_id=orm.maquina_id,
        produccion_total=float(orm.produccion_total),
        produccion_buena=float(orm.produccion_buena),
        produccion_rechazada=float(orm.produccion_rechazada),
        unidad=orm.unidad,
        hora_inicio=orm.hora_inicio,
        hora_fin=orm.hora_fin,
        tiempo_operativo_min=orm.tiempo_operativo_min,
        observaciones=orm.observaciones,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _parada_domain(orm: ParadaORM) -> Parada:
    return Parada(
        id=orm.id,
        maquina_id=orm.maquina_id,
        motivo=orm.motivo,
        inicio=orm.inicio,
        tipo=orm.tipo,
        op_id=orm.op_id,
        registro_id=orm.registro_id,
        turno_id=orm.turno_id,
        fin=orm.fin,
        duracion_min=orm.duracion_min,
        observacion=orm.observacion,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def _incidencia_domain(orm: IncidenciaCalidadORM) -> IncidenciaCalidad:
    return IncidenciaCalidad(
        id=orm.id,
        maquina_id=orm.maquina_id,
        tipo=orm.tipo,
        descripcion=orm.descripcion,
        estado=orm.estado,
        fecha=orm.fecha,
        op_id=orm.op_id,
        registro_id=orm.registro_id,
        codigo=orm.codigo,
        lote=orm.lote,
        cantidad=float(orm.cantidad) if orm.cantidad is not None else None,
        turno_id=orm.turno_id,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


class SqlOrdenProduccionRepository(OrdenProduccionRepository):
    """Implementación de OrdenProduccionRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self, planta_id: str | None = None,
                       maquina_id: str | None = None,
                       estado: str | None = None) -> list[OrdenProduccion]:
        stmt = select(OrdenProduccionORM)
        if planta_id:
            stmt = stmt.where(OrdenProduccionORM.planta_id == planta_id)
        if maquina_id:
            stmt = stmt.where(OrdenProduccionORM.maquina_id == maquina_id)
        if estado:
            stmt = stmt.where(OrdenProduccionORM.estado == estado)
        stmt = stmt.order_by(OrdenProduccionORM.numero_op.desc())
        result = await self.session.execute(stmt)
        return [_orden_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, op_id: str) -> OrdenProduccion | None:
        orm = await self.session.get(OrdenProduccionORM, op_id)
        return _orden_domain(orm) if orm else None

    async def get_by_numero(self, numero_op: str) -> OrdenProduccion | None:
        result = await self.session.execute(
            select(OrdenProduccionORM).where(OrdenProduccionORM.numero_op == numero_op)
        )
        orm = result.scalar_one_or_none()
        return _orden_domain(orm) if orm else None

    async def next_numero(self) -> str:
        anio = date.today().year
        prefijo = f"OP-{anio}-"
        result = await self.session.execute(
            select(func.max(OrdenProduccionORM.numero_op))
            .where(OrdenProduccionORM.numero_op.like(f"{prefijo}%"))
        )
        ultimo = result.scalar_one_or_none()
        if ultimo is None:
            return f"{prefijo}0001"
        try:
            siguiente = int(str(ultimo).rsplit("-", 1)[1]) + 1
        except (ValueError, IndexError):
            siguiente = 1
        return f"{prefijo}{siguiente:04d}"

    async def create(self, orden: OrdenProduccion) -> OrdenProduccion:
        orm = OrdenProduccionORM(
            id=_uuid(),
            numero_op=orden.numero_op,
            cliente=orden.cliente,
            producto=orden.producto,
            descripcion=orden.descripcion,
            unidad=orden.unidad,
            cantidad_planificada=orden.cantidad_planificada,
            cantidad_producida=orden.cantidad_producida,
            prioridad=orden.prioridad,
            estado=orden.estado,
            fecha_emision=orden.fecha_emision,
            fecha_programada=orden.fecha_programada,
            fecha_fin_estimada=orden.fecha_fin_estimada,
            planta_id=orden.planta_id,
            area_id=orden.area_id,
            maquina_id=orden.maquina_id,
            operario_id=orden.operario_id,
            turno_id=orden.turno_id,
            fecha_inicio=orden.fecha_inicio,
            fecha_fin=orden.fecha_fin,
        )
        self.session.add(orm)
        await self.session.flush()
        return _orden_domain(orm)

    async def update(self, orden: OrdenProduccion) -> None:
        orm = await self.session.get(OrdenProduccionORM, orden.id)
        if orm is None:
            return
        orm.cliente = orden.cliente
        orm.producto = orden.producto
        orm.descripcion = orden.descripcion
        orm.unidad = orden.unidad
        orm.cantidad_planificada = orden.cantidad_planificada
        orm.prioridad = orden.prioridad
        orm.estado = orden.estado
        orm.fecha_programada = orden.fecha_programada
        orm.fecha_fin_estimada = orden.fecha_fin_estimada
        orm.planta_id = orden.planta_id
        orm.area_id = orden.area_id
        orm.maquina_id = orden.maquina_id
        orm.operario_id = orden.operario_id
        orm.turno_id = orden.turno_id
        orm.fecha_inicio = orden.fecha_inicio
        orm.fecha_fin = orden.fecha_fin
        await self.session.flush()

    async def add_produccion(self, op_id: str, cantidad: float) -> None:
        orm = await self.session.get(OrdenProduccionORM, op_id)
        if orm is None:
            return
        orm.cantidad_producida = float(orm.cantidad_producida) + cantidad
        await self.session.flush()

    async def delete(self, op_id: str) -> None:
        await self.session.execute(
            delete(OrdenProduccionORM).where(OrdenProduccionORM.id == op_id)
        )


class SqlRegistroDiarioRepository(RegistroDiarioRepository):
    """Implementación de RegistroDiarioRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self, op_id: str | None = None, fecha: date | None = None,
                       planta_id: str | None = None, area_id: str | None = None,
                       maquina_id: str | None = None, turno_id: str | None = None,
                       operario_id: str | None = None) -> list[RegistroDiario]:
        stmt = select(RegistroDiarioORM)
        if op_id:
            stmt = stmt.where(RegistroDiarioORM.op_id == op_id)
        if fecha:
            stmt = stmt.where(RegistroDiarioORM.fecha == fecha)
        if planta_id:
            stmt = stmt.where(RegistroDiarioORM.planta_id == planta_id)
        if area_id:
            stmt = stmt.where(RegistroDiarioORM.area_id == area_id)
        if maquina_id:
            stmt = stmt.where(RegistroDiarioORM.maquina_id == maquina_id)
        if turno_id:
            stmt = stmt.where(RegistroDiarioORM.turno_id == turno_id)
        if operario_id:
            stmt = stmt.where(RegistroDiarioORM.operario_id == operario_id)
        stmt = stmt.order_by(RegistroDiarioORM.fecha.desc(), RegistroDiarioORM.created_at.desc())
        result = await self.session.execute(stmt)
        return [_registro_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, registro_id: str) -> RegistroDiario | None:
        orm = await self.session.get(RegistroDiarioORM, registro_id)
        return _registro_domain(orm) if orm else None

    async def get_duplicado(self, op_id: str, fecha: date, turno_id: str) -> RegistroDiario | None:
        result = await self.session.execute(
            select(RegistroDiarioORM)
            .where(RegistroDiarioORM.op_id == op_id)
            .where(RegistroDiarioORM.fecha == fecha)
            .where(RegistroDiarioORM.turno_id == turno_id)
        )
        orm = result.scalar_one_or_none()
        return _registro_domain(orm) if orm else None

    async def create(self, registro: RegistroDiario) -> RegistroDiario:
        orm = RegistroDiarioORM(
            id=_uuid(),
            op_id=registro.op_id,
            fecha=registro.fecha,
            turno_id=registro.turno_id,
            operario_id=registro.operario_id,
            planta_id=registro.planta_id,
            area_id=registro.area_id,
            maquina_id=registro.maquina_id,
            produccion_total=registro.produccion_total,
            produccion_buena=registro.produccion_buena,
            produccion_rechazada=registro.produccion_rechazada,
            unidad=registro.unidad,
            hora_inicio=registro.hora_inicio,
            hora_fin=registro.hora_fin,
            tiempo_operativo_min=registro.tiempo_operativo_min,
            observaciones=registro.observaciones,
        )
        self.session.add(orm)
        await self.session.flush()
        return _registro_domain(orm)

    async def update(self, registro: RegistroDiario) -> None:
        orm = await self.session.get(RegistroDiarioORM, registro.id)
        if orm is None:
            return
        orm.op_id = registro.op_id
        orm.fecha = registro.fecha
        orm.turno_id = registro.turno_id
        orm.operario_id = registro.operario_id
        orm.produccion_total = registro.produccion_total
        orm.produccion_buena = registro.produccion_buena
        orm.produccion_rechazada = registro.produccion_rechazada
        orm.unidad = registro.unidad
        orm.hora_inicio = registro.hora_inicio
        orm.hora_fin = registro.hora_fin
        orm.tiempo_operativo_min = registro.tiempo_operativo_min
        orm.observaciones = registro.observaciones
        await self.session.flush()

    async def delete(self, registro_id: str) -> None:
        await self.session.execute(
            delete(RegistroDiarioORM).where(RegistroDiarioORM.id == registro_id)
        )

    async def totales(self, filtros: dict[str, Any]) -> dict[str, float | int]:
        stmt = select(
            func.count(RegistroDiarioORM.id),
            func.coalesce(func.sum(RegistroDiarioORM.produccion_total), 0.0),
            func.coalesce(func.sum(RegistroDiarioORM.produccion_buena), 0.0),
            func.coalesce(func.sum(RegistroDiarioORM.produccion_rechazada), 0.0),
            func.coalesce(func.sum(RegistroDiarioORM.tiempo_operativo_min), 0),
        )
        if filtros.get("fecha"):
            stmt = stmt.where(RegistroDiarioORM.fecha == filtros["fecha"])
        if filtros.get("fecha_desde"):
            stmt = stmt.where(RegistroDiarioORM.fecha >= filtros["fecha_desde"])
        if filtros.get("fecha_hasta"):
            stmt = stmt.where(RegistroDiarioORM.fecha <= filtros["fecha_hasta"])
        if filtros.get("planta_id"):
            stmt = stmt.where(RegistroDiarioORM.planta_id == filtros["planta_id"])
        if filtros.get("area_id"):
            stmt = stmt.where(RegistroDiarioORM.area_id == filtros["area_id"])
        if filtros.get("maquina_id"):
            stmt = stmt.where(RegistroDiarioORM.maquina_id == filtros["maquina_id"])
        if filtros.get("turno_id"):
            stmt = stmt.where(RegistroDiarioORM.turno_id == filtros["turno_id"])
        if filtros.get("operario_id"):
            stmt = stmt.where(RegistroDiarioORM.operario_id == filtros["operario_id"])
        if filtros.get("op_id"):
            stmt = stmt.where(RegistroDiarioORM.op_id == filtros["op_id"])
        result = await self.session.execute(stmt)
        contador, total, buena, rechazada, tiempo_operativo = result.one()
        return {
            "registros": int(contador),
            "produccion_total": float(total),
            "produccion_buena": float(buena),
            "produccion_rechazada": float(rechazada),
            "tiempo_operativo_min": int(tiempo_operativo),
        }

    @staticmethod
    def _filtros_aplicables(filtros: dict[str, Any], stmt: Any) -> Any:
        """Aplica los filtros comunes de agregación (claves en minúscula)."""
        if filtros.get("fecha"):
            stmt = stmt.where(RegistroDiarioORM.fecha == filtros["fecha"])
        if filtros.get("fecha_desde"):
            stmt = stmt.where(RegistroDiarioORM.fecha >= filtros["fecha_desde"])
        if filtros.get("fecha_hasta"):
            stmt = stmt.where(RegistroDiarioORM.fecha <= filtros["fecha_hasta"])
        if filtros.get("planta_id"):
            stmt = stmt.where(RegistroDiarioORM.planta_id == filtros["planta_id"])
        if filtros.get("area_id"):
            stmt = stmt.where(RegistroDiarioORM.area_id == filtros["area_id"])
        if filtros.get("maquina_id"):
            stmt = stmt.where(RegistroDiarioORM.maquina_id == filtros["maquina_id"])
        if filtros.get("turno_id"):
            stmt = stmt.where(RegistroDiarioORM.turno_id == filtros["turno_id"])
        if filtros.get("operario_id"):
            stmt = stmt.where(RegistroDiarioORM.operario_id == filtros["operario_id"])
        if filtros.get("op_id"):
            stmt = stmt.where(RegistroDiarioORM.op_id == filtros["op_id"])
        return stmt

    async def serie_diaria(self, fecha_desde: date, fecha_hasta: date,
                           filtros: dict[str, Any]) -> list[dict[str, Any]]:
        stmt = (
            select(
                RegistroDiarioORM.fecha,
                func.count(RegistroDiarioORM.id),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_total), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_buena), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_rechazada), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.tiempo_operativo_min), 0),
            )
            .where(RegistroDiarioORM.fecha >= fecha_desde)
            .where(RegistroDiarioORM.fecha <= fecha_hasta)
            .group_by(RegistroDiarioORM.fecha)
            .order_by(RegistroDiarioORM.fecha)
        )
        stmt = self._filtros_aplicables(filtros, stmt)
        result = await self.session.execute(stmt)
        return [
            {
                "fecha": fecha,
                "registros": int(n),
                "produccion_total": float(total),
                "produccion_buena": float(buena),
                "produccion_rechazada": float(rechazada),
                "tiempo_operativo_min": int(tiempo),
            }
            for fecha, n, total, buena, rechazada, tiempo in result.all()
        ]

    async def agrupar_por_maquina(self, filtros: dict[str, Any]) -> list[dict[str, Any]]:
        stmt = (
            select(
                RegistroDiarioORM.maquina_id,
                func.count(RegistroDiarioORM.id),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_total), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_buena), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_rechazada), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.tiempo_operativo_min), 0),
            )
            .group_by(RegistroDiarioORM.maquina_id)
            .order_by(func.sum(RegistroDiarioORM.produccion_total).desc())
        )
        stmt = self._filtros_aplicables(filtros, stmt)
        result = await self.session.execute(stmt)
        return [
            {
                "maquina_id": maquina_id,
                "registros": int(n),
                "produccion_total": float(total),
                "produccion_buena": float(buena),
                "produccion_rechazada": float(rechazada),
                "tiempo_operativo_min": int(tiempo),
            }
            for maquina_id, n, total, buena, rechazada, tiempo in result.all()
        ]

    async def agrupar_por_operario(self, filtros: dict[str, Any]) -> list[dict[str, Any]]:
        stmt = (
            select(
                RegistroDiarioORM.operario_id,
                func.count(RegistroDiarioORM.id),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_total), 0.0),
                func.coalesce(func.sum(RegistroDiarioORM.produccion_buena), 0.0),
            )
            .group_by(RegistroDiarioORM.operario_id)
            .order_by(func.sum(RegistroDiarioORM.produccion_total).desc())
        )
        stmt = self._filtros_aplicables(filtros, stmt)
        result = await self.session.execute(stmt)
        return [
            {
                "operario_id": operario_id,
                "registros": int(n),
                "produccion_total": float(total),
                "produccion_buena": float(buena),
            }
            for operario_id, n, total, buena in result.all()
        ]


class SqlParadaRepository(ParadaRepository):
    """Implementación de ParadaRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self, maquina_id: str | None = None, op_id: str | None = None,
                       fecha_inicio: date | None = None, fecha_fin: date | None = None,
                       turno_id: str | None = None) -> list[Parada]:
        stmt = select(ParadaORM)
        if maquina_id:
            stmt = stmt.where(ParadaORM.maquina_id == maquina_id)
        if op_id:
            stmt = stmt.where(ParadaORM.op_id == op_id)
        if turno_id:
            stmt = stmt.where(ParadaORM.turno_id == turno_id)
        if fecha_inicio:
            desde = datetime.combine(fecha_inicio, datetime.min.time())
            stmt = stmt.where(or_(ParadaORM.fin >= desde, ParadaORM.fin.is_(None)))
        if fecha_fin:
            hasta = datetime.combine(fecha_fin + timedelta(days=1), datetime.min.time())
            stmt = stmt.where(ParadaORM.inicio < hasta)
        stmt = stmt.order_by(ParadaORM.inicio.desc())
        result = await self.session.execute(stmt)
        return [_parada_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, parada_id: str) -> Parada | None:
        orm = await self.session.get(ParadaORM, parada_id)
        return _parada_domain(orm) if orm else None

    async def get_abierta_en_maquina(self, maquina_id: str) -> Parada | None:
        result = await self.session.execute(
            select(ParadaORM)
            .where(ParadaORM.maquina_id == maquina_id)
            .where(ParadaORM.fin.is_(None))
            .order_by(ParadaORM.inicio.desc())
            .limit(1)
        )
        orm = result.scalar_one_or_none()
        return _parada_domain(orm) if orm else None

    async def create(self, parada: Parada) -> Parada:
        orm = ParadaORM(
            id=_uuid(),
            op_id=parada.op_id,
            registro_id=parada.registro_id,
            maquina_id=parada.maquina_id,
            turno_id=parada.turno_id,
            motivo=parada.motivo,
            tipo=parada.tipo,
            inicio=parada.inicio,
            fin=parada.fin,
            duracion_min=parada.duracion_min,
            observacion=parada.observacion,
        )
        self.session.add(orm)
        await self.session.flush()
        return _parada_domain(orm)

    async def cerrar(self, parada_id: str, fin: datetime, duracion_min: int) -> None:
        orm = await self.session.get(ParadaORM, parada_id)
        if orm is None:
            return
        orm.fin = fin
        orm.duracion_min = duracion_min
        await self.session.flush()

    async def update(self, parada: Parada) -> None:
        orm = await self.session.get(ParadaORM, parada.id)
        if orm is None:
            return
        orm.op_id = parada.op_id
        orm.registro_id = parada.registro_id
        orm.maquina_id = parada.maquina_id
        orm.turno_id = parada.turno_id
        orm.motivo = parada.motivo
        orm.tipo = parada.tipo
        orm.inicio = parada.inicio
        orm.fin = parada.fin
        orm.duracion_min = parada.duracion_min
        orm.observacion = parada.observacion
        await self.session.flush()


class SqlCalidadRepository(CalidadRepository):
    """Implementación de CalidadRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self, op_id: str | None = None, maquina_id: str | None = None,
                       tipo: str | None = None,
                       fecha_inicio: date | None = None,
                       fecha_fin: date | None = None) -> list[IncidenciaCalidad]:
        stmt = select(IncidenciaCalidadORM)
        if op_id:
            stmt = stmt.where(IncidenciaCalidadORM.op_id == op_id)
        if maquina_id:
            stmt = stmt.where(IncidenciaCalidadORM.maquina_id == maquina_id)
        if tipo:
            stmt = stmt.where(IncidenciaCalidadORM.tipo == tipo)
        if fecha_inicio:
            stmt = stmt.where(IncidenciaCalidadORM.fecha >= fecha_inicio)
        if fecha_fin:
            stmt = stmt.where(IncidenciaCalidadORM.fecha <= fecha_fin)
        stmt = stmt.order_by(
            IncidenciaCalidadORM.fecha.desc(), IncidenciaCalidadORM.created_at.desc()
        )
        result = await self.session.execute(stmt)
        return [_incidencia_domain(o) for o in result.scalars().all()]

    async def get_by_id(self, incidencia_id: str) -> IncidenciaCalidad | None:
        orm = await self.session.get(IncidenciaCalidadORM, incidencia_id)
        return _incidencia_domain(orm) if orm else None

    async def create(self, incidencia: IncidenciaCalidad) -> IncidenciaCalidad:
        orm = IncidenciaCalidadORM(
            id=_uuid(),
            op_id=incidencia.op_id,
            registro_id=incidencia.registro_id,
            maquina_id=incidencia.maquina_id,
            tipo=incidencia.tipo,
            codigo=incidencia.codigo,
            descripcion=incidencia.descripcion,
            lote=incidencia.lote,
            cantidad=incidencia.cantidad,
            estado=incidencia.estado,
            fecha=incidencia.fecha,
            turno_id=incidencia.turno_id,
        )
        self.session.add(orm)
        await self.session.flush()
        return _incidencia_domain(orm)

    async def update(self, incidencia: IncidenciaCalidad) -> None:
        orm = await self.session.get(IncidenciaCalidadORM, incidencia.id)
        if orm is None:
            return
        orm.op_id = incidencia.op_id
        orm.registro_id = incidencia.registro_id
        orm.maquina_id = incidencia.maquina_id
        orm.tipo = incidencia.tipo
        orm.codigo = incidencia.codigo
        orm.descripcion = incidencia.descripcion
        orm.lote = incidencia.lote
        orm.cantidad = incidencia.cantidad
        orm.estado = incidencia.estado
        orm.fecha = incidencia.fecha
        orm.turno_id = incidencia.turno_id
        await self.session.flush()
