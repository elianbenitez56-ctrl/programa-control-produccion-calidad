"""Pruebas del refresh (rotación M1-D5) y logout."""
from datetime import UTC, datetime, timedelta

import pytest

from app.application.use_cases.auth import (
    LoginPasswordUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
)
from app.core.exceptions import AuthenticationError
from app.core.security import hash_token
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher, JwtTokenService
from tests.unit.fakes import (
    FakeAuditRepository,
    FakeClock,
    FakeRolRepository,
    FakeSesionOperarioRepository,
    FakeSesionRepository,
    FakeUserRepository,
    fake_rol,
    fake_user,
)


def _build():
    users = FakeUserRepository()
    users.add(fake_user(usuario="admin",
                        password_hash=Argon2PasswordHasher().hash("Clave1234")))
    roles = FakeRolRepository()
    roles.set_roles("u-1", [fake_rol("admin", "usuario:ver")])
    sessions = FakeSesionRepository()
    audit = FakeAuditRepository()
    clock = FakeClock()
    login = LoginPasswordUseCase(users, roles, sessions, Argon2PasswordHasher(),
                                 JwtTokenService(), audit, clock)
    return users, roles, sessions, audit, clock, login


async def _login() -> tuple[str, FakeSesionRepository, FakeUserRepository, FakeRolRepository, FakeClock]:
    users, roles, sessions, _, clock, login = _build()
    result = await login.execute("admin", "Clave1234", "ip", "ua", "r")
    return result.tokens.refresh_token, sessions, users, roles, clock


async def test_refresh_rota_el_token_anterior() -> None:
    refresh, sessions, users, roles, clock = await _login()
    uc = RefreshTokenUseCase(users, roles, sessions, JwtTokenService(),
                             FakeAuditRepository(), clock)

    res = await uc.execute(refresh, None, None, "r")
    assert res.tokens.access_token
    assert res.tokens.refresh_token != refresh

    activas = [s for s in sessions.auth if not s.revocada]
    assert len(activas) == 1
    assert activas[0].refresh_hash != refresh


async def test_refresh_con_token_ya_revocado_falla() -> None:
    refresh, sessions, users, roles, clock = await _login()
    uc = RefreshTokenUseCase(users, roles, sessions, JwtTokenService(),
                             FakeAuditRepository(), clock)

    await uc.execute(refresh, None, None, "r")  # rota (revoca el anterior)
    with pytest.raises(AuthenticationError):
        await uc.execute(refresh, None, None, "r")  # el viejo ya no sirve


async def test_refresh_con_sesion_expirada_falla() -> None:
    refresh, sessions, users, roles, clock = await _login()
    uc = RefreshTokenUseCase(users, roles, sessions, JwtTokenService(),
                             FakeAuditRepository(), clock)
    for s in sessions.auth:
        s.expira = datetime.now(UTC) - timedelta(minutes=1)

    with pytest.raises(AuthenticationError):
        await uc.execute(refresh, None, None, "r")


async def test_refresh_rechaza_access_token() -> None:
    _, _, users, roles, clock = await _login()
    uc = RefreshTokenUseCase(users, roles, sessions := FakeSesionRepository(),
                             JwtTokenService(), FakeAuditRepository(), clock)
    access = JwtTokenService().create_access_token("u-1", ["usuario:ver"])
    with pytest.raises(AuthenticationError):
        await uc.execute(access, None, None, "r")


async def test_logout_revoca_sesion_y_cierra_operaria() -> None:
    refresh, sessions, users, roles, clock = await _login()
    audit = FakeAuditRepository()
    op_sessions = FakeSesionOperarioRepository()
    uc = LogoutUseCase(sessions, op_sessions, audit)

    await uc.execute("u-1", hash_token(refresh), "ip", "ua", "r")
    assert all(s.revocada for s in sessions.auth)
    assert audit.rows[-1]["accion"] == "logout"


async def test_logout_sin_refresh_cierra_solo_operaria() -> None:
    _, sessions, users, roles, clock = await _login()
    op_sessions = FakeSesionOperarioRepository()
    uc = LogoutUseCase(sessions, op_sessions, FakeAuditRepository())
    await uc.execute("u-1", None, None, None, "r")
    assert not any(s.revocada for s in sessions.auth)