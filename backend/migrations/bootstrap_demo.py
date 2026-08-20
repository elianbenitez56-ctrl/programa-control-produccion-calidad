"""Inicializa el esquema SQLite del modo demo y carga los datos base."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import Base, SessionLocal, engine
from app.infrastructure import orm  # noqa: F401  (registra todos los modelos)
from migrations.seed import seed


async def main() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        await seed(session)
        await session.commit()
    print("SQLite demo inicializado")


if __name__ == "__main__":
    asyncio.run(main())
