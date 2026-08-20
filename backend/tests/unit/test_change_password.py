"""Pruebas del cambio de contraseña (RN-VAL)."""
import pytest

from app.application.use_cases.auth import ChangePasswordUseCase
from app.core.exceptions import AuthenticationError, BusinessRuleError
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher
from tests.unit.fakes import (
    FakeAuditRepository,
    FakeSesionRepository,
    FakeUserRepository,
    fake_user,
)


def build():
    users = FakeUserRepository()
    users.add(fake_user(usuario="admin",
                        password_hash=Argon2PasswordHasher().hash("Clave1234")))
    sessions = FakeSesionRepository()
    audit = FakeAuditRepository()
    uc = ChangePasswordUseCase(users, Argon2PasswordHasher(), sessions, audit)
    return uc, users, sessions, audit


async def test_cambio_exitoso_revoca_sesiones() -> None:
    uc, users, sessions, audit = build()
    await sessions.create("u-1", "h1", __import__("datetime").datetime.now().replace(tzinfo=__import__("datetime").UTC), None, None, "j1")

    await uc.execute("u-1", "Clave1234", "NuevaClave1", "ip", "r")
    assert users.users["u-1"].password_hash != Argon2PasswordHasher().hash("Clave1234")
    assert sessions.auth[0].revocada
    assert audit.rows[-1]["accion"] == "password_cambiada"


async def test_password_actual_incorrecta_lanza() -> None:
    uc, *_ = build()
    with pytest.raises(AuthenticationError):
        await uc.execute("u-1", "clave-mala", "NuevaClave1", None, "r")


async def test_password_debil_lanza_regla() -> None:
    uc, *_ = build()
    with pytest.raises(BusinessRuleError):
        await uc.execute("u-1", "Clave1234", "corta1", None, "r")