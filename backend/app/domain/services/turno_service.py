"""Deducción del turno vigente (RN-TUR-001).

Lógica de dominio pura: dado el calendario de turnos de una planta y el
momento actual (hora del servidor), determina el turno activo.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta


@dataclass(frozen=True)
class Turno:
    """Turno de producción con horario y días de la semana aplicables."""

    id: str  # UUID del turno en persistencia
    codigo: str
    nombre: str
    hora_inicio: time
    hora_fin: time
    dias_semana: frozenset[int]  # 1=lunes ... 7=domingo


def _compute_intervalo(turno: Turno, fecha_bas: datetime) -> tuple[datetime, datetime]:
    """Convierte un turno a intervalo [inicio, fin) sobre una fecha base.

    Soporta turnos que cruzan la medianoche (ej. 22:00 -> 06:00).
    """
    inicio = datetime.combine(fecha_bas.date(), turno.hora_inicio, tzinfo=fecha_bas.tzinfo)
    fin = datetime.combine(fecha_bas.date(), turno.hora_fin, tzinfo=fecha_bas.tzinfo)
    if turno.hora_fin <= turno.hora_inicio:
        fin += timedelta(days=1)
    return inicio, fin


def _cubre(turno: Turno, momento: datetime, fecha_bas: datetime | None = None) -> bool:
    """Verifica si el turno cubre `momento` usando `fecha_bas` como día base."""
    fecha_base = fecha_bas or momento
    inicio, fin = _compute_intervalo(turno, fecha_base)
    # El turno sólo aplica si el día del inicio está en sus días de la semana.
    if inicio.weekday() + 1 not in turno.dias_semana:
        return False
    return inicio <= momento < fin


class TurnoService:
    """Servicio puro que deduce el turno vigente según la hora del servidor."""

    @staticmethod
    def turno_vigente(turnos: list[Turno], ahora: datetime) -> Turno | None:
        """Devuelve el turno activo en `ahora` o None si no hay turno.

        Evalúa primero los turnos que inician el día de `ahora`; luego los
        turnos del día anterior que cruzan la medianoche y siguen activos
        (RN-TUR-001: corte de turno por hora del servidor).
        """
        if not turnos:
            return None

        for turno in turnos:
            if _cubre(turno, ahora):
                return turno

        ayer = ahora - timedelta(days=1)
        for turno in turnos:
            if _cubre(turno, ahora, fecha_bas=ayer):
                return turno
        return None