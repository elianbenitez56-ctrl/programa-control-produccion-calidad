"""Entidades de dominio del módulo Producción.

La Orden de Producción es la entidad raíz del MES: el registro diario cuelga
de ella y las paradas/incidencias de calidad se anclan a ambos. El cálculo
de indicadores (OEE, disponibilidad, rendimiento, calidad) vive en los casos
de uso y se obtiene por agregación, nunca con tablas propias.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time


@dataclass
class OrdenProduccion:
    """Orden de producción: entidad raíz del flujo operativo."""

    id: str
    numero_op: str
    cliente: str
    producto: str
    descripcion: str | None
    unidad: str
    cantidad_planificada: float | None
    cantidad_producida: float
    prioridad: int
    estado: str
    fecha_emision: date
    fecha_programada: date | None
    planta_id: str
    area_id: str
    maquina_id: str
    operario_id: str | None
    turno_id: str | None
    fecha_fin_estimada: date | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class RegistroDiario:
    """Captura del turno asociada a una OP (única fuente de cantidades)."""

    id: str
    op_id: str
    fecha: date
    turno_id: str
    operario_id: str
    planta_id: str
    area_id: str
    maquina_id: str
    produccion_total: float
    produccion_buena: float
    produccion_rechazada: float
    unidad: str
    hora_inicio: time | None = None
    hora_fin: time | None = None
    tiempo_operativo_min: int | None = None
    observaciones: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Parada:
    """Tiempo improductivo de la máquina (duración calculada al cerrar)."""

    id: str
    maquina_id: str
    motivo: str
    inicio: datetime
    tipo: str = "no_planeada"
    op_id: str | None = None
    registro_id: str | None = None
    turno_id: str | None = None
    fin: datetime | None = None
    duracion_min: int | None = None
    observacion: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class IncidenciaCalidad:
    """Hallazgo de calidad (defecto, inspección o NC) del lote/OP."""

    id: str
    maquina_id: str
    tipo: str
    descripcion: str | None
    estado: str
    fecha: date
    op_id: str | None = None
    registro_id: str | None = None
    codigo: str | None = None
    lote: str | None = None
    cantidad: float | None = None
    turno_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
