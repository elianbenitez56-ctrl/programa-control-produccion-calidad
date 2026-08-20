"""Adaptador PDF del Módulo Reportes (ReportLab).

Implementa el puerto `ReportBuilder`. Es infraestructura pura: no contiene
lógica de negocio ni datos; los casos de uso del Módulo 12 la alimentarán.
"""
from collections.abc import Iterable
from io import BytesIO
from typing import Any

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import-untyped]
from reportlab.lib.units import mm  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.application.ports.report_ports import ReportBuilder

_BORDER = colors.HexColor("#cbd5e1")
_HEADER_BG = colors.HexColor("#1e293b")
_STRIPE_BG = colors.HexColor("#f1f5f9")


class PdfReportBuilder(ReportBuilder):
    """Construye un documento PDF A4 con ReportLab (portada + tablas)."""

    def __init__(self, page_title: str = "Reporte SIGPC") -> None:
        self._buffer = BytesIO()
        self._doc = SimpleDocTemplate(
            self._buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )
        base = getSampleStyleSheet()
        self._title_style = ParagraphStyle(
            "Titulo", parent=base["Title"], fontSize=18, spaceAfter=10
        )
        self._section_style = ParagraphStyle(
            "Seccion", parent=base["Heading2"], spaceBefore=10, spaceAfter=4
        )
        self._text_style = base["BodyText"]
        self._flow: list[Any] = [Paragraph(page_title, self._title_style)]

    def add_title(self, title: str, subtitle: str | None = None) -> None:
        self._flow.append(Paragraph(title, self._section_style))
        if subtitle:
            self._flow.append(Paragraph(subtitle, self._text_style))

    def add_section(self, titulo: str, campos: dict[str, Any]) -> None:
        self._flow.append(Paragraph(titulo, self._section_style))
        rows: list[list[str]] = [
            [Paragraph(str(k), self._text_style), Paragraph(str(v), self._text_style)]
            for k, v in campos.items()
        ]
        self._append_table(rows, widths=[50 * mm, None])

    def add_table(self, headers: list[str], rows: Iterable[Iterable[Any]]) -> None:
        data: list[list[str]] = [headers, *[[str(c) for c in row] for row in rows]]
        self._append_table(data)

    def _append_table(
        self, data: list[list[str]], widths: list[float | None] | None = None
    ) -> None:
        style = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _HEADER_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, _BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _STRIPE_BG]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
        table = Table(data, colWidths=widths, repeatRows=1)
        table.setStyle(style)
        self._flow.append(Spacer(1, 4))
        self._flow.append(table)
        self._flow.append(Spacer(1, 8))

    def to_bytes(self) -> bytes:
        self._doc.build(self._flow)
        return self._buffer.getvalue()
