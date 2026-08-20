"""Puertos (interfaces) del Módulo Reportes y Exportaciones (Módulo 12).

Los casos de uso de reportes (por desarrollarse) producirán documentos de
exportación a través de este contrato. Las implementaciones viven en
`app.infrastructure.adapters` (PDF con ReportLab, XLSX con openpyxl).
"""
from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import Any


class ReportBuilder(ABC):
    """Contrato para construir documentos de exportación (PDF, XLSX).

    Infraestructura pura: construir el documento no decide *qué* se reporta;
    eso lo harán los casos de uso del Módulo 12 alimentando el builder.
    """

    @abstractmethod
    def add_title(self, title: str, subtitle: str | None = None) -> None: ...

    @abstractmethod
    def add_section(self, titulo: str, campos: dict[str, Any]) -> None:
        """Añade un bloque de encabezado: título de sección + pares clave/valor."""

    @abstractmethod
    def add_table(self, headers: list[str], rows: Iterable[Iterable[Any]]) -> None:
        """Añade una tabla con cabecera (primera fila resaltada)."""

    @abstractmethod
    def to_bytes(self) -> bytes:
        """Devuelve el documento final en bytes, listo para descargar."""
