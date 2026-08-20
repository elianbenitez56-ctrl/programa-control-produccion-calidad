"""Pruebas del login con usuario/contraseña (incluye lockout)."""
import pytest

from app.application.use_cases.auth import LoginPasswordUseCase
from app.core.exceptions import AccountLockedError, AuthenticationError
from app.domain.entities.auth import UserState
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher, JwtTokenService
from tests.unit.fakes import (
    FakeAuditRepository,
    FakeClock,
    FakeRolRepository,
    FakeSesionRepository,
    FakeUserRepository,
    fake_rol,
    fake_user,
)


def build(password: str = "Clave1234", usuario: str = "admin"):
    users = FakeUserRepository()
    users.add(fake_user(usuario=usuario, password_hash=Argon2PasswordHasher().hash(password)))
    roles = FakeRolRepository()
    roles.set_roles("u-1", [fake_rol("admin", "usuario:ver", "dashboard:ver")])
    sessions = FakeSesionRepository()
    audit = FakeAuditRepository()
    uc = LoginPasswordUseCase(users, roles, sessions, Argon2PasswordHasher(),
                              JwtTokenService(), audit, FakeClock())
    return uc, users, roles, sessions, audit


async def test_login_exitoso_emite_tokens_y_permisos() -> None:
    uc, _, _, sessions, audit = build()
    result = await uc.execute("admin", "Clave1234", "1.1.1.1", "ua", "req1")

    assert result.tokens.access_token
    assert result.tokens.refresh_token
    assert result.usuario["roles"] == ["admin"]
    assert "usuario:ver" in result.usuario["permisos"]
    assert sessions.auth  # guardó la sesión
    assert audit.rows[-1]["accion"] == "login_password"


async def test_credenciales_invalidas_audita_y_lanza() -> None:
    uc, _, _, _, audit = build()
    with pytest.raises(AuthenticationError):
        await uc.execute("admin", "clave-incorrecta", None, None, "req2")
    assert any(r["accion"] == "login_fallido" for r in audit.rows)


async def test_usuario_inexistente_lanza() -> None:
    uc, _, _, _, _ = build()
    with pytest.raises(AuthenticationError):
        await uc.execute("noexiste", "Clave1234", None, None, "req3")


async def test_usuario_suspendido_no_puede_entrar() -> None:
    uc, users, _, _, _ = build()
    users.add(fake_user(id="u-2", usuario="inactivo",
                        password_hash=Argon2PasswordHasher().hash("Clave1234"),
                        estado=UserState.SUSPENDIDO))
    with pytest.raises(AuthenticationError):
        await uc.execute("inactivo", "Clave1234", None, None, "req4")


async def test_lockout_despues_de_5_intentos_fallidos() -> None:
    uc, _, _, _, _ = build()
    for _ in range(5):
        with pytest.raises((AuthenticationError, AccountLockedError)):
            await uc.execute("admin", "clave-incorrecta", None, None, "req5")
    with pytest.raises(AccountLockedError):
        await uc.execute("admin", "Clave1234", None, None, "req6")


async def test_login_valido_tras_intentos_resetea_contador() -> None:
    uc, users, _, _, _ = build()
    with pytest.raises(AuthenticationError):
        await uc.execute("admin", "mal", None, None, "r")
    result = await uc.execute("admin", "Clave1234", None, None, "r")
    assert result.usuario["usuario"] == "admin"
    assert users.users["u-1"].extra.get("intentos_fallidos", 0) == 0
