"""Pruebas del login de kiosko (PIN/QR/RFID + sesión operaria)."""
from datetime import UTC, datetime, time

import pytest

from app.application.use_cases.auth import LoginKioskoUseCase
from app.core.exceptions import AuthenticationError, BusinessRuleError
from app.domain.entities.auth import LoginMethod
from app.domain.services.turno_service import Turno
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher, JwtTokenService
from tests.unit.fakes import (
    FakeAuditRepository,
    FakeClock,
    FakeKioskoRepository,
    FakeRolRepository,
    FakeSesionOperarioRepository,
    FakeSesionRepository,
    FakeTurnoRepository,
    FakeUserRepository,
    fake_rol,
    fake_user,
)

KIOSKO = {"id": "k-1", "maquina_id": "m-1", "planta_id": "p-1",
          "codigo": "K-01", "tipo_ingreso": "mixto", "token": "tok-1"}

T1 = Turno(id="t-1", codigo="T1", nombre="Turno 1",
           hora_inicio=time(6, 0), hora_fin=time(14, 0), dias_semana=frozenset(range(1, 8)))


def build():
    users = FakeUserRepository()
    users.add(fake_user(
        id="u-1", usuario="op1", rfid_tag="RFID-1", qr_secret="QR-1",
        pin_hash=Argon2PasswordHasher().hash("1234")))
    roles = FakeRolRepository()
    roles.set_roles("u-1", [fake_rol("operario", "op:ver", "parada:registrar")])
    sessions = FakeSesionRepository()
    op_sessions = FakeSesionOperarioRepository()
    kioskos = FakeKioskoRepository([KIOSKO])
    turnos = FakeTurnoRepository([T1])
    audit = FakeAuditRepository()
    reloj = FakeClock(datetime(2026, 8, 3, 8, 0, tzinfo=UTC))
    uc = LoginKioskoUseCase(users, roles, sessions, op_sessions, kioskos, turnos,
                            Argon2PasswordHasher(), JwtTokenService(), audit, reloj)
    return uc, users, roles, sessions, op_sessions, audit


async def test_login_rfid_crea_sesion_operaria_con_turno() -> None:
    uc, _, _, sessions, op_sessions, audit = build()
    result = await uc.execute(LoginMethod.RFID, "RFID-1", "tok-1", "ip", None, "r")

    assert result.access_token
    assert result.sesion_operario["maquina_id"] == "m-1"
    assert result.sesion_operario["turno_id"] == "t-1"
    assert sessions.auth
    assert audit.rows[-1]["accion"] == "kiosko_login"


async def test_login_qr() -> None:
    uc, *_ = build()
    result = await uc.execute(LoginMethod.QR, "QR-1", "tok-1", None, None, "r")
    assert result.usuario["usuario"] == "op1"


async def test_login_pin_con_identificador() -> None:
    uc, *_ = build()
    result = await uc.execute(LoginMethod.PIN, "1234", "tok-1", None, None, "r",
                              identificador="op1")
    assert result.usuario["usuario"] == "op1"


async def test_login_pin_sin_identificador_fracasa() -> None:
    uc, *_ = build()
    with pytest.raises(AuthenticationError):
        await uc.execute(LoginMethod.PIN, "1234", "tok-1", None, None, "r")


async def test_kiosko_invalido_lanza() -> None:
    uc, *_ = build()
    with pytest.raises(BusinessRuleError):
        await uc.execute(LoginMethod.RFID, "RFID-1", "token-inexistente", None, None, "r")


async def test_credencial_rfid_incorrecta_lanza() -> None:
    uc, *_ = build()
    with pytest.raises(AuthenticationError):
        await uc.execute(LoginMethod.RFID, "RFID-999", "tok-1", None, None, "r")


async def test_segundo_login_reemplaza_la_sesion_activa() -> None:
    uc, users, _, _, op_sessions, _ = build()
    users.add(fake_user(id="u-2", usuario="otro", rfid_tag="RFID-2",
                        pin_hash=Argon2PasswordHasher().hash("9999")))
    await uc.execute(LoginMethod.RFID, "RFID-1", "tok-1", None, None, "r")
    await uc.execute(LoginMethod.RFID, "RFID-2", "tok-1", None, None, "r")

    activa = await op_sessions.get_active_for_machine("m-1")
    assert activa is not None
    assert activa.usuario_id == "u-2"
    vieja = [s for s in op_sessions.op if s.maquina_id == "m-1" and s.usuario_id == "u-1"]
    assert vieja and vieja[0].estado == "cerrada"
    assert vieja[0].motivo_cierre == "reemplazo"


async def test_credencial_con_usuario_inactivo_fracasa() -> None:
    uc, users, *_ = build()
    users.users["u-1"].estado = "suspendido"
    with pytest.raises(AuthenticationError):
        await uc.execute(LoginMethod.RFID, "RFID-1", "tok-1", None, None, "r")