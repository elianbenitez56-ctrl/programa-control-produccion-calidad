"""Pruebas del servicio de turno vigente (RN-TUR-001, dominio puro)."""
from datetime import UTC, datetime, time

from app.domain.services.turno_service import Turno, TurnoService


def turno(id: str, inicio: time, fin: time, dias: set[int]) -> Turno:
    return Turno(id=id, codigo=id, nombre=id, hora_inicio=inicio, hora_fin=fin,
                 dias_semana=frozenset(dias))


T1 = turno("t1", time(6, 0), time(14, 0), set(range(1, 8)))
T2 = turno("t2", time(14, 0), time(22, 0), set(range(1, 8)))
T3 = turno("t3", time(22, 0), time(6, 0), set(range(1, 8)))


def test_turno_matutino() -> None:
    ahora = datetime(2026, 8, 3, 9, 0, tzinfo=UTC)  # lunes
    assert TurnoService.turno_vigente([T1, T2, T3], ahora) == T1


def test_turno_vespertino() -> None:
    ahora = datetime(2026, 8, 3, 18, 0, tzinfo=UTC)
    assert TurnoService.turno_vigente([T1, T2, T3], ahora) == T2


def test_turno_nocturno_cruza_medianoche() -> None:
    ahora = datetime(2026, 8, 3, 23, 30, tzinfo=UTC)
    assert TurnoService.turno_vigente([T1, T2, T3], ahora) == T3


def test_turno_nocturno_despues_de_medianoche() -> None:
    ahora = datetime(2026, 8, 4, 1, 0, tzinfo=UTC)  # martes de madrugada
    assert TurnoService.turno_vigente([T1, T2, T3], ahora) == T3


def test_sin_turnos_devuelve_none() -> None:
    ahora = datetime(2026, 8, 3, 9, 0, tzinfo=UTC)
    assert TurnoService.turno_vigente([], ahora) is None


def test_respeta_dias_de_la_semana() -> None:
    t_dom = turno("tdom", time(6, 0), time(14, 0), {7})  # solo domingo
    lunes = datetime(2026, 8, 3, 9, 0, tzinfo=UTC)
    assert TurnoService.turno_vigente([t_dom], lunes) is None
    domingo = datetime(2026, 8, 9, 9, 0, tzinfo=UTC)
    assert TurnoService.turno_vigente([t_dom], domingo) == t_dom


def test_fuera_de_horario_devuelve_none() -> None:
    # Turnos 6-14 y 14-22: las 3 de la madrugada del lunes no tiene turno
    # porque T3 (22-6) no está en la lista.
    ahora = datetime(2026, 8, 3, 3, 0, tzinfo=UTC)
    assert TurnoService.turno_vigente([T1, T2], ahora) is None
