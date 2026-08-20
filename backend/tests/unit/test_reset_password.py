"""Pruebas de recuperación de contraseña (token single-use, M1-D1)."""
from datetime import UTC, datetime

import pytest

from app.application.use_cases.auth import RequestPasswordResetUseCase, ResetPasswordUseCase
from app.core.exceptions import AuthenticationError, BusinessRuleError
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher, JwtTokenService
from tests.unit.fakes import (
    FakeAuditRepository,
    FakeResetTokenRepository,
    FakeSesionRepository,
    FakeUserRepository,
    fake_user,
)


def build_user():
    users = FakeUserRepository()
    users.add(fake_user(usuario="admin", email="admin@sigpc.local",
                        password_hash=Argon2PasswordHasher().hash("Clave1234")))
    return users


class CapturaEmail:
    def __init__(self) -> None:
        self.envios: list[tuple[str, str, str]] = []

    async def send(self, to: str, subject: str, body: str) -> None:
        self.envios.append((to, subject, body))


async def test_solicitud_emite_enlace_y_el_token_funciona_una_vez() -> None:
    users = build_user()
    emails = CapturaEmail()
    audit = FakeAuditRepository()
    req = RequestPasswordResetUseCase(users, JwtTokenService(), emails, audit)
    await req.execute("admin@sigpc.local", "http://front", "r")

    assert emails.envios
    token = emails.envios[0][2].split("token=")[1].split("\n")[0]

    sessions = FakeSesionRepository()
    resets = FakeResetTokenRepository()
    reset = ResetPasswordUseCase(users, JwtTokenService(), sessions, resets,
                                 Argon2PasswordHasher(), audit)
    await reset.execute(token, "NuevaClave1", "ip", "r")
    assert users.users["u-1"].password_hash != Argon2PasswordHasher().hash("Clave1234")

    # Segundo uso del mismo token debe fallar.
    with pytest.raises(AuthenticationError):
        await reset.execute(token, "OtraClave1", "ip", "r")


async def test_solicitud_no_revela_si_el_email_existe() -> None:
    users = build_user()
    emails = CapturaEmail()
    req = RequestPasswordResetUseCase(users, JwtTokenService(), emails, FakeAuditRepository())
    await req.execute("no-existe@sigpc.local", "http://front", "r")
    assert not emails.envios


async def test_token_de_tipo_incorrecto_es_rechazado() -> None:
    users = build_user()
    sessions = FakeSesionRepository()
    resets = FakeResetTokenRepository()
    audit = FakeAuditRepository()
    reset = ResetPasswordUseCase(users, JwtTokenService(), sessions, resets,
                                 Argon2PasswordHasher(), audit)
    access = JwtTokenService().create_access_token("u-1", [])
    with pytest.raises(AuthenticationError):
        await reset.execute(access, "NuevaClave1", "ip", "r")


async def test_password_debil_en_reset_lanza_regla() -> None:
    users = build_user()
    emails = CapturaEmail()
    audit = FakeAuditRepository()
    req = RequestPasswordResetUseCase(users, JwtTokenService(), emails, audit)
    await req.execute("admin@sigpc.local", "http://front", "r")
    token = emails.envios[0][2].split("token=")[1].split("\n")[0]

    reset = ResetPasswordUseCase(users, JwtTokenService(), FakeSesionRepository(),
                                 FakeResetTokenRepository(), Argon2PasswordHasher(), audit)
    with pytest.raises(BusinessRuleError):
        await reset.execute(token, "corta1", "ip", "r")


async def test_reset_revoca_sesiones_activas() -> None:
    users = build_user()
    emails = CapturaEmail()
    audit = FakeAuditRepository()
    req = RequestPasswordResetUseCase(users, JwtTokenService(), emails, audit)
    await req.execute("admin@sigpc.local", "http://front", "r")
    token = emails.envios[0][2].split("token=")[1].split("\n")[0]

    sessions = FakeSesionRepository()
    await sessions.create("u-1", "h1", datetime.now(UTC), None, None, "j1")
    reset = ResetPasswordUseCase(users, JwtTokenService(), sessions,
                                 FakeResetTokenRepository(), Argon2PasswordHasher(), audit)
    await reset.execute(token, "NuevaClave1", "ip", "r")
    assert sessions.auth[0].revocada