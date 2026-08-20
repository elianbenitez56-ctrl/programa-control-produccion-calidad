"""Entidades de dominio del Módulo Inventario.

Catálogo global de productos (referencias) y movimientos de inventario
que cambian el stock por producto y planta. La lógica de negocio (signos,
validación de saldo) vive en los casos de uso; aquí solo el modelo de datos.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class Producto:
    """Referencia de producto del catálogo (global, no por planta)."""

    id: str
    codigo: str
    nombre: str
    descripcion: str | None
    unidad: str
    activo: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class MovimientoInventario:
    """Movimiento de stock de un producto en una planta.

    `cantidad` es con signo: entrada > 0, salida < 0 y ajuste libre
    (positivo añade, negativo resta). El stock se deriva por agregación.
    """

    id: str
    producto_id: str
    planta_id: str
    tipo: str  # entrada | salida | ajuste
    cantidad: float
    motivo: str
    referencia: str | None
    fecha: date
    created_at: datetime | None = None
    updated_at: datetime | None = None
