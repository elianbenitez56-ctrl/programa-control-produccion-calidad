"""Configuración de las pruebas de integración.

Usa la base `sigpc_test` (TEST_DATABASE_URL), aplica las migraciones Alembic
una vez por sesión y limpia las tablas entre pruebas.
"""
import os

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:sigpc@localhost:5433/sigpc_test",
)

# Debe definirse antes de importar app.core.database / app.main.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["RATE_LIMIT_DEFAULT_PER_MINUTE"] = "10000"
os.environ["RATE_LIMIT_LOGIN_PER_MINUTE"] = "10000"

import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _aplicar_migraciones():
    """Aplica (idempotente) el esquema sobre sigpc_test."""
    from alembic import command
    from alembic.config import Config

    from app.core.config import get_settings

    get_settings.cache_clear()
    cfg = Config(str(os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")))
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
async def _limpiar_tablas():
    """Vacía todas las tablas antes de cada prueba."""
    from app.core.database import SessionLocal

    async with SessionLocal() as session:
        await session.execute(
            text(
                "TRUNCATE bitacora, sesiones_operario, sesiones_autenticacion, "
                "usuarios_roles, rol_permisos, kioskos, turnos_dias, turnos, maquinas, "
                "areas, estados, configuraciones_sistema, colores, usuarios, roles, "
                "permisos, plantas RESTART IDENTITY CASCADE"
            )
        )
        await session.commit()
    yield


@pytest.fixture
async def session():
    """Sesión de base de datos de prueba."""
    from app.core.database import SessionLocal

    async with SessionLocal() as s:
        yield s


@pytest.fixture
async def client():
    """Cliente HTTP contra la app FastAPI (base de prueba)."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
