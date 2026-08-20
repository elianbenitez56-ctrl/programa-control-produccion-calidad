"""Logging estructurado con structlog.

- Formato JSON en staging/prod, consola en dev.
- Campos enriquecidos: request_id, user_id, planta_id, módulo.
"""
import logging
import sys

import structlog

from app.core.config import get_settings


def configure_logging() -> None:
    """Configura structlog y el logging estándar al arrancar la app."""
    settings = get_settings()
    level = settings.log_level.upper()

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    shared_processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        timestamper,
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.log_format == "json":
        renderer: structlog.typing.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*shared_processors, structlog.processors.format_exc_info, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )

    # Redirige logs de librerías al nivel configurado.
    logging.basicConfig(stream=sys.stdout, level=level)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Obtiene un logger enlazado de structlog."""
    return structlog.get_logger(name)