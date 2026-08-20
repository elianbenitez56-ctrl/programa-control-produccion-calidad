"""Entidades de dominio del Módulo Configuración.

Catálogos base de cada planta (análisis funcional RF16): plantas, áreas,
máquinas y turnos. La lógica de negocio vive en los casos de uso; aquí solo
el modelo de datos con los atributos mínimos necesarios.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Any


@dataclass
class Planta:
    """Tenant del producto multi-planta."""

    id: str
    codigo: str
    nombre: str
    pais: str | None
    zona_horaria: str
    idioma: str
    activo: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Area:
    """Agrupación física/funcional de máquinas dentro de una planta."""

    id: str
    planta_id: str
    codigo: str
    nombre: str
    responsable_id: str | None
    activo: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Maquina:
    """Recurso productivo central: todo lo que ocurre se ancla a ella."""

    id: str
    planta_id: str
    area_id: str
    codigo: str
    nombre: str
    tiene_contador: bool
    tipo_contador: str
    velocidad_maxima: float | None
    config_contador: dict[str, Any] | None
    parametros: dict[str, Any] | None
    estado_actual_id: str
    activo: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Turno:
    """Bloque horario productivo configurado por la planta (RN-TUR-001)."""

    id: str
    planta_id: str
    codigo: str
    nombre: str
    hora_inicio: time
    hora_fin: time
    activo: bool
    dias_semana: list[int] = field(default_factory=list)  # 1=lunes ... 7=domingo
    created_at: datetime | None = None
    updated_at: datetime | None = None
