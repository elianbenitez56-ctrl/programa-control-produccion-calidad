"""Reloj del sistema: única fuente de hora (RN-GEN-001)."""
from datetime import UTC, datetime

from app.application.ports.auth_ports import Clock


class SystemClock(Clock):
    """Devuelve la hora UTC del servidor."""

    def now_utc(self) -> datetime:
        return datetime.now(UTC)
