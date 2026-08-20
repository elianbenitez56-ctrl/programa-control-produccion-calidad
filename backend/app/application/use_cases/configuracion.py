"""Casos de uso del Módulo Configuración (plantas, áreas, máquinas, turnos).

Orquestan el CRUD de los catálogos base por planta (RF16) y registran cada
mutación en la bitácora. Solo dependen de puertos; la capa API exige los
permisos correspondientes (`*:ver` / `*:configurar`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time
from typing import Any

from app.application.ports.auth_ports import AuditRepository
from app.application.ports.configuracion_ports import (
    AreaRepository,
    MaquinaRepository,
    PlantaRepository,
    TurnoRepository,
)
from app.application.serializers import (
    area_publica,
    maquina_publica,
    planta_publica,
    turno_publico,
)
from app.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    EntityNotFoundError,
)
from app.domain.entities.configuracion import Area, Maquina, Planta, Turno

_MODULO = "configuracion"

_TIPOS_CONTADOR = ("opc", "manual")
_DIAS_VALIDOS = frozenset(range(1, 8))


# ---------------------------------------------------------------- Plantas


@dataclass
class PlantaDatos:
    codigo: str
    nombre: str
    pais: str | None = None
    zona_horaria: str = "America/Mexico_City"
    idioma: str = "es"
    activo: bool = True


class PlantasUseCases:
    """CRUD de plantas (tenant)."""

    def __init__(self, plantas: PlantaRepository, audit: AuditRepository) -> None:
        self.plantas = plantas
        self.audit = audit

    async def listar(self) -> list[dict[str, Any]]:
        return [planta_publica(p) for p in await self.plantas.list_all()]

    async def ver(self, planta_id: str) -> dict[str, Any]:
        planta = await self.plantas.get_by_id(planta_id)
        if planta is None:
            raise EntityNotFoundError("planta")
        return planta_publica(planta)

    async def crear(self, datos: PlantaDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "planta")
        if await self.plantas.get_by_codigo(datos.codigo) is not None:
            raise ConflictError("PLANTA_DUPLICADA", message="El código de planta ya existe")
        planta = await self.plantas.create(Planta(id="", **datos.__dict__))
        await self._audit("planta_creada", "planta", planta.id,
                          None, planta_publica(planta), usuario_id, ip, request_id)
        return planta_publica(planta)

    async def editar(self, planta_id: str, datos: PlantaDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "planta")
        planta = await self.plantas.get_by_id(planta_id)
        if planta is None:
            raise EntityNotFoundError("planta")
        anterior = planta_publica(planta)
        planta.codigo = datos.codigo
        planta.nombre = datos.nombre
        planta.pais = datos.pais
        planta.zona_horaria = datos.zona_horaria
        planta.idioma = datos.idioma
        await self.plantas.update(planta)
        await self._audit("planta_editada", "planta", planta.id,
                          anterior, planta_publica(planta), usuario_id, ip, request_id)
        return planta_publica(planta)

    async def desactivar(self, planta_id: str, usuario_id: str | None,
                         ip: str | None, request_id: str | None) -> None:
        planta = await self.plantas.get_by_id(planta_id)
        if planta is None:
            raise EntityNotFoundError("planta")
        await self.plantas.set_activo(planta_id, False)
        await self._audit("planta_desactivada", "planta", planta_id,
                          planta_publica(planta), None, usuario_id, ip, request_id)

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# ---------------------------------------------------------------- Áreas


@dataclass
class AreaDatos:
    planta_id: str
    codigo: str
    nombre: str
    responsable_id: str | None = None
    activo: bool = True


class AreasUseCases:
    """CRUD de áreas por planta."""

    def __init__(self, areas: AreaRepository, plantas: PlantaRepository,
                 audit: AuditRepository) -> None:
        self.areas = areas
        self.plantas = plantas
        self.audit = audit

    async def listar(self) -> list[dict[str, Any]]:
        return [area_publica(a) for a in await self.areas.list_all()]

    async def ver(self, area_id: str) -> dict[str, Any]:
        area = await self.areas.get_by_id(area_id)
        if area is None:
            raise EntityNotFoundError("area")
        return area_publica(area)

    async def crear(self, datos: AreaDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "area")
        await self._validar_planta(datos.planta_id)
        if await self.areas.get_by_planta_codigo(datos.planta_id, datos.codigo) is not None:
            raise ConflictError("AREA_DUPLICADA",
                                message="El código de área ya existe en la planta")
        area = await self.areas.create(Area(id="", **datos.__dict__))
        await self._audit("area_creada", "area", area.id, None, area_publica(area),
                          usuario_id, ip, request_id)
        return area_publica(area)

    async def editar(self, area_id: str, datos: AreaDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "area")
        area = await self.areas.get_by_id(area_id)
        if area is None:
            raise EntityNotFoundError("area")
        await self._validar_planta(datos.planta_id)
        anterior = area_publica(area)
        area.planta_id = datos.planta_id
        area.codigo = datos.codigo
        area.nombre = datos.nombre
        area.responsable_id = datos.responsable_id
        await self.areas.update(area)
        await self._audit("area_editada", "area", area.id, anterior, area_publica(area),
                          usuario_id, ip, request_id)
        return area_publica(area)

    async def desactivar(self, area_id: str, usuario_id: str | None,
                         ip: str | None, request_id: str | None) -> None:
        area = await self.areas.get_by_id(area_id)
        if area is None:
            raise EntityNotFoundError("area")
        await self.areas.set_activo(area_id, False)
        await self._audit("area_desactivada", "area", area_id, area_publica(area),
                          None, usuario_id, ip, request_id)

    async def _validar_planta(self, planta_id: str) -> None:
        if await self.plantas.get_by_id(planta_id) is None:
            raise EntityNotFoundError("planta")

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# -------------------------------------------------------------- Máquinas


@dataclass
class MaquinaDatos:
    planta_id: str
    area_id: str
    codigo: str
    nombre: str
    tiene_contador: bool = False
    tipo_contador: str = "ninguno"
    velocidad_maxima: float | None = None
    config_contador: dict[str, Any] | None = None
    parametros: dict[str, Any] | None = None
    estado_actual_id: str | None = None
    activo: bool = True


class MaquinasUseCases:
    """CRUD de máquinas."""

    def __init__(self, maquinas: MaquinaRepository, areas: AreaRepository,
                 plantas: PlantaRepository, audit: AuditRepository) -> None:
        self.maquinas = maquinas
        self.areas = areas
        self.plantas = plantas
        self.audit = audit

    async def listar(self) -> list[dict[str, Any]]:
        return [maquina_publica(m) for m in await self.maquinas.list_all()]

    async def ver(self, maquina_id: str) -> dict[str, Any]:
        maquina = await self.maquinas.get_by_id(maquina_id)
        if maquina is None:
            raise EntityNotFoundError("maquina")
        return maquina_publica(maquina)

    async def crear(self, datos: MaquinaDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "maquina")
        _validar_contador(datos.tiene_contador, datos.tipo_contador)
        await self._validar_contexto(datos.planta_id, datos.area_id)
        if await self.maquinas.get_by_planta_codigo(datos.planta_id, datos.codigo) is not None:
            raise ConflictError("MAQUINA_DUPLICADA",
                                message="El código de máquina ya existe en la planta")
        estado_id = datos.estado_actual_id or await self.maquinas.estado_inicial_por_defecto()
        if estado_id is None:
            raise BusinessRuleError("ESTADO_MAQUINA_NO_CONFIGURADO",
                                    message="No existe estado inicial 'lista' para máquinas")
        maquina = await self.maquinas.create(
            Maquina(id="", **{**datos.__dict__, "estado_actual_id": estado_id})
        )
        await self._audit("maquina_creada", "maquina", maquina.id, None,
                          maquina_publica(maquina), usuario_id, ip, request_id)
        return maquina_publica(maquina)

    async def editar(self, maquina_id: str, datos: MaquinaDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "maquina")
        _validar_contador(datos.tiene_contador, datos.tipo_contador)
        maquina = await self.maquinas.get_by_id(maquina_id)
        if maquina is None:
            raise EntityNotFoundError("maquina")
        await self._validar_contexto(datos.planta_id, datos.area_id)
        anterior = maquina_publica(maquina)
        maquina.planta_id = datos.planta_id
        maquina.area_id = datos.area_id
        maquina.codigo = datos.codigo
        maquina.nombre = datos.nombre
        maquina.tiene_contador = datos.tiene_contador
        maquina.tipo_contador = datos.tipo_contador
        maquina.velocidad_maxima = datos.velocidad_maxima
        maquina.config_contador = datos.config_contador
        maquina.parametros = datos.parametros
        if datos.estado_actual_id:
            maquina.estado_actual_id = datos.estado_actual_id
        await self.maquinas.update(maquina)
        await self._audit("maquina_editada", "maquina", maquina.id, anterior,
                          maquina_publica(maquina), usuario_id, ip, request_id)
        return maquina_publica(maquina)

    async def desactivar(self, maquina_id: str, usuario_id: str | None,
                         ip: str | None, request_id: str | None) -> None:
        maquina = await self.maquinas.get_by_id(maquina_id)
        if maquina is None:
            raise EntityNotFoundError("maquina")
        await self.maquinas.set_activo(maquina_id, False)
        await self._audit("maquina_desactivada", "maquina", maquina_id,
                          maquina_publica(maquina), None, usuario_id, ip, request_id)

    async def _validar_contexto(self, planta_id: str, area_id: str) -> None:
        if await self.plantas.get_by_id(planta_id) is None:
            raise EntityNotFoundError("planta")
        area = await self.areas.get_by_id(area_id)
        if area is None:
            raise EntityNotFoundError("area")
        if area.planta_id != planta_id:
            raise BusinessRuleError("AREA_DE_OTRA_PLANTA",
                                    message="El área no pertenece a la planta indicada")

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# ---------------------------------------------------------------- Turnos


@dataclass
class TurnoDatos:
    planta_id: str
    codigo: str
    nombre: str
    hora_inicio: time
    hora_fin: time
    dias_semana: list[int] = field(default_factory=list)
    activo: bool = True


class TurnosUseCases:
    """CRUD de turnos (bloques horarios por planta)."""

    def __init__(self, turnos: TurnoRepository, plantas: PlantaRepository,
                 audit: AuditRepository) -> None:
        self.turnos = turnos
        self.plantas = plantas
        self.audit = audit

    async def listar(self) -> list[dict[str, Any]]:
        return [turno_publico(t) for t in await self.turnos.list_all()]

    async def ver(self, turno_id: str) -> dict[str, Any]:
        turno = await self.turnos.get_by_id(turno_id)
        if turno is None:
            raise EntityNotFoundError("turno")
        return turno_publico(turno)

    async def crear(self, datos: TurnoDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "turno")
        _validar_horario(datos.hora_inicio, datos.hora_fin)
        dias = _validar_dias(datos.dias_semana)
        await self._validar_planta(datos.planta_id)
        if await self.turnos.get_by_planta_codigo(datos.planta_id, datos.codigo) is not None:
            raise ConflictError("TURNO_DUPLICADO",
                                message="El código de turno ya existe en la planta")
        turno = await self.turnos.create(
            Turno(id="", **{**datos.__dict__, "dias_semana": dias})
        )
        await self._audit("turno_creado", "turno", turno.id, None, turno_publico(turno),
                          usuario_id, ip, request_id)
        return turno_publico(turno)

    async def editar(self, turno_id: str, datos: TurnoDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_codigo(datos.codigo, "turno")
        _validar_horario(datos.hora_inicio, datos.hora_fin)
        dias = _validar_dias(datos.dias_semana)
        turno = await self.turnos.get_by_id(turno_id)
        if turno is None:
            raise EntityNotFoundError("turno")
        await self._validar_planta(datos.planta_id)
        anterior = turno_publico(turno)
        turno.planta_id = datos.planta_id
        turno.codigo = datos.codigo
        turno.nombre = datos.nombre
        turno.hora_inicio = datos.hora_inicio
        turno.hora_fin = datos.hora_fin
        turno.dias_semana = dias
        await self.turnos.update(turno)
        await self._audit("turno_editado", "turno", turno.id, anterior, turno_publico(turno),
                          usuario_id, ip, request_id)
        return turno_publico(turno)

    async def desactivar(self, turno_id: str, usuario_id: str | None,
                         ip: str | None, request_id: str | None) -> None:
        turno = await self.turnos.get_by_id(turno_id)
        if turno is None:
            raise EntityNotFoundError("turno")
        await self.turnos.set_activo(turno_id, False)
        await self._audit("turno_desactivado", "turno", turno_id, turno_publico(turno),
                          None, usuario_id, ip, request_id)

    async def _validar_planta(self, planta_id: str) -> None:
        if await self.plantas.get_by_id(planta_id) is None:
            raise EntityNotFoundError("planta")

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# ---------------------------------------------------------------- Helpers


def _validar_codigo(codigo: str, recurso: str) -> None:
    if not codigo or not codigo.strip():
        raise BusinessRuleError("CODIGO_VACIO", message=f"El código de {recurso} es obligatorio")


def _validar_contador(tiene_contador: bool, tipo_contador: str) -> None:
    if tiene_contador and tipo_contador not in _TIPOS_CONTADOR:
        raise BusinessRuleError("CONTADOR_INVALIDO",
                                message="Con contador activo, el tipo debe ser 'opc' o 'manual'")
    if not tiene_contador and tipo_contador != "ninguno":
        raise BusinessRuleError("CONTADOR_INVALIDO",
                                message="Sin contador activo, el tipo debe ser 'ninguno'")


def _validar_horario(hora_inicio: time, hora_fin: time) -> None:
    if hora_inicio == hora_fin:
        raise BusinessRuleError("HORARIO_INVALIDO",
                                message="La hora de fin debe ser distinta de la de inicio")


def _validar_dias(dias: list[int] | None) -> list[int]:
    if not dias:
        raise BusinessRuleError("DIAS_INVALIDOS",
                                message="Debe indicar al menos un día de la semana")
    invalidos = [d for d in dias if d not in _DIAS_VALIDOS]
    if invalidos:
        raise BusinessRuleError("DIAS_INVALIDOS", details={"dias_invalidos": invalidos})
    return sorted(set(dias))
