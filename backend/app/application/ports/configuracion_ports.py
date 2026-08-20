"""Puertos (interfaces) del Módulo Configuración.

El dominio/aplicación define contratos; infrastructure los implementa sobre
SQLAlchemy (repositorios) y la capa API los orquesta por recurso.
"""
from abc import ABC, abstractmethod

from app.domain.entities.configuracion import Area, Maquina, Planta, Turno


class PlantaRepository(ABC):
    """Persistencia de plantas (tenant)."""

    @abstractmethod
    async def list_all(self) -> list[Planta]: ...

    @abstractmethod
    async def get_by_id(self, planta_id: str) -> Planta | None: ...

    @abstractmethod
    async def get_by_codigo(self, codigo: str) -> Planta | None: ...

    @abstractmethod
    async def create(self, planta: Planta) -> Planta: ...

    @abstractmethod
    async def update(self, planta: Planta) -> None: ...

    @abstractmethod
    async def set_activo(self, planta_id: str, activo: bool) -> None: ...


class AreaRepository(ABC):
    """Persistencia de áreas por planta."""

    @abstractmethod
    async def list_all(self) -> list[Area]: ...

    @abstractmethod
    async def get_by_id(self, area_id: str) -> Area | None: ...

    @abstractmethod
    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Area | None: ...

    @abstractmethod
    async def create(self, area: Area) -> Area: ...

    @abstractmethod
    async def update(self, area: Area) -> None: ...

    @abstractmethod
    async def set_activo(self, area_id: str, activo: bool) -> None: ...


class MaquinaRepository(ABC):
    """Persistencia de máquinas."""

    @abstractmethod
    async def list_all(self) -> list[Maquina]: ...

    @abstractmethod
    async def get_by_id(self, maquina_id: str) -> Maquina | None: ...

    @abstractmethod
    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Maquina | None: ...

    @abstractmethod
    async def estado_inicial_por_defecto(self) -> str | None:
        """Id del estado 'lista' del proceso 'maquina' (estado inicial del catálogo)."""

    @abstractmethod
    async def create(self, maquina: Maquina) -> Maquina: ...

    @abstractmethod
    async def update(self, maquina: Maquina) -> None: ...

    @abstractmethod
    async def set_activo(self, maquina_id: str, activo: bool) -> None: ...


class TurnoRepository(ABC):
    """Persistencia de turnos y sus días de la semana."""

    @abstractmethod
    async def list_all(self) -> list[Turno]: ...

    @abstractmethod
    async def get_by_id(self, turno_id: str) -> Turno | None: ...

    @abstractmethod
    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Turno | None: ...

    @abstractmethod
    async def create(self, turno: Turno) -> Turno: ...

    @abstractmethod
    async def update(self, turno: Turno) -> None: ...

    @abstractmethod
    async def set_activo(self, turno_id: str, activo: bool) -> None: ...
