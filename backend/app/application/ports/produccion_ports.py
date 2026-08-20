"""Puertos (interfaces) del módulo Producción.

El dominio/aplicación define los contratos; infraestructura los implementa
sobre SQLAlchemy. Los resúmenes/indicadores se obtienen siempre por los
métodos de agregación de estos repositorios (una sola fuente de datos).
"""
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any

from app.domain.entities.produccion import (
    IncidenciaCalidad,
    OrdenProduccion,
    Parada,
    RegistroDiario,
)


class OrdenProduccionRepository(ABC):
    """Persistencia de órdenes de producción (entidad raíz)."""

    @abstractmethod
    async def list_all(self, planta_id: str | None = None,
                       maquina_id: str | None = None,
                       estado: str | None = None) -> list[OrdenProduccion]: ...

    @abstractmethod
    async def get_by_id(self, op_id: str) -> OrdenProduccion | None: ...

    @abstractmethod
    async def get_by_numero(self, numero_op: str) -> OrdenProduccion | None: ...

    @abstractmethod
    async def next_numero(self) -> str:
        """Genera el siguiente número de OP correlativo (OP-YYYY-NNNN)."""

    @abstractmethod
    async def create(self, orden: OrdenProduccion) -> OrdenProduccion: ...

    @abstractmethod
    async def update(self, orden: OrdenProduccion) -> None: ...

    @abstractmethod
    async def add_produccion(self, op_id: str, cantidad: float) -> None: ...

    @abstractmethod
    async def delete(self, op_id: str) -> None: ...


class RegistroDiarioRepository(ABC):
    """Persistencia de registros diarios (captura por turno)."""

    @abstractmethod
    async def list_all(self, op_id: str | None = None, fecha: date | None = None,
                       planta_id: str | None = None, area_id: str | None = None,
                       maquina_id: str | None = None, turno_id: str | None = None,
                       operario_id: str | None = None) -> list[RegistroDiario]: ...

    @abstractmethod
    async def get_by_id(self, registro_id: str) -> RegistroDiario | None: ...

    @abstractmethod
    async def get_duplicado(self, op_id: str, fecha: date,
                            turno_id: str) -> RegistroDiario | None: ...

    @abstractmethod
    async def create(self, registro: RegistroDiario) -> RegistroDiario: ...

    @abstractmethod
    async def update(self, registro: RegistroDiario) -> None: ...

    @abstractmethod
    async def delete(self, registro_id: str) -> None: ...

    @abstractmethod
    async def totales(self, filtros: dict[str, Any]) -> dict[str, float | int]:
        """Agregados de producción según filtros (Dashboard/Reportes/Indicadores)."""

    @abstractmethod
    async def serie_diaria(self, fecha_desde: date, fecha_hasta: date,
                           filtros: dict[str, Any]) -> list[dict[str, Any]]:
        """Producción agregada por día en el rango (serie para gráficas)."""

    @abstractmethod
    async def agrupar_por_maquina(self, filtros: dict[str, Any]) -> list[dict[str, Any]]:
        """Agregados por máquina (Producción por máquina e Indicadores)."""

    @abstractmethod
    async def agrupar_por_operario(self, filtros: dict[str, Any]) -> list[dict[str, Any]]:
        """Agregados por operario (Producción por operario)."""


class ParadaRepository(ABC):
    """Persistencia de paradas (tiempos improductivos)."""

    @abstractmethod
    async def list_all(self, maquina_id: str | None = None, op_id: str | None = None,
                       fecha_inicio: date | None = None, fecha_fin: date | None = None,
                       turno_id: str | None = None) -> list[Parada]: ...

    @abstractmethod
    async def get_by_id(self, parada_id: str) -> Parada | None: ...

    @abstractmethod
    async def get_abierta_en_maquina(self, maquina_id: str) -> Parada | None: ...

    @abstractmethod
    async def create(self, parada: Parada) -> Parada: ...

    @abstractmethod
    async def cerrar(self, parada_id: str, fin: datetime, duracion_min: int) -> None: ...

    @abstractmethod
    async def update(self, parada: Parada) -> None: ...


class CalidadRepository(ABC):
    """Persistencia de incidencias de calidad."""

    @abstractmethod
    async def list_all(self, op_id: str | None = None, maquina_id: str | None = None,
                       tipo: str | None = None,
                       fecha_inicio: date | None = None,
                       fecha_fin: date | None = None) -> list[IncidenciaCalidad]: ...

    @abstractmethod
    async def get_by_id(self, incidencia_id: str) -> IncidenciaCalidad | None: ...

    @abstractmethod
    async def create(self, incidencia: IncidenciaCalidad) -> IncidenciaCalidad: ...

    @abstractmethod
    async def update(self, incidencia: IncidenciaCalidad) -> None: ...
