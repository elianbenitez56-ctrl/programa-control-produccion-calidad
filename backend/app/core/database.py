"""Configuración del motor asíncrono de SQLAlchemy y la sesión."""
from collections.abc import AsyncIterator

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base declarativa con convención de nombres consistente."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def build_engine():
    """Crea el engine asíncrono según la configuración del ambiente."""
    settings = get_settings()
    url = settings.resolved_database_url
    connect_args = {"check_same_thread": False} if settings.demo_mode else {}
    return create_async_engine(
        url,
        echo=settings.debug,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = build_engine()

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Dependencia de FastAPI que provee una sesión por request."""
    async with SessionLocal() as session:
        yield session


async def dispose_engine() -> None:
    """Cierra el engine al apagar la aplicación."""
    await engine.dispose()
