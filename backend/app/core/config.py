"""Configuración central de la aplicación SIGPC.

Carga variables de entorno vía pydantic-settings. Fallo rápido ante valores
de seguridad inválidos en entornos productivos.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la aplicación por ambiente."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Entornos
    environment: Literal["dev", "staging", "prod"] = "dev"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Base de datos
    database_url: str | None = None
    sigpc_sqlite_path: str = "sigpc-demo.db"

    # Usuario inicial creado por migrations/seed.py
    sigpc_admin_usuario: str = "admin"
    sigpc_admin_email: str = "admin@sigpc.local"
    sigpc_admin_password: str = "Admin1234"
    sigpc_supervisor_password: str = "Supervisor123"

    # Seguridad JWT
    jwt_secret: str = "cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7
    reset_token_expire_minutes: int = 15

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Logging
    log_level: str = "INFO"
    log_format: str = "console"  # console | json

    # Kiosko
    kiosk_header: str = "X-Kiosk-Id"

    # Rate limiting
    rate_limit_default_per_minute: int = 120
    rate_limit_login_per_minute: int = 5

    # Frontend
    frontend_url: str = "http://localhost:5173"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> str | None:
        """Adapta URLs PostgreSQL y deja vacío el modo demo SQLite."""
        if value is None:
            return None
        url = str(value).strip()
        if not url:
            return None
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgres://")
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
        return url

    @property
    def demo_mode(self) -> bool:
        """Indica que la instalación debe usar SQLite local/efímero."""
        return self.database_url is None

    @property
    def resolved_database_url(self) -> str:
        """Devuelve la URL efectiva sin cambiar la configuración PostgreSQL."""
        if self.database_url is not None:
            return self.database_url
        path = Path(self.sigpc_sqlite_path).expanduser()
        if not path.is_absolute():
            path = Path.cwd() / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{path.as_posix()}"

    @property
    def cors_origin_list(self) -> list[str]:
        """Lista de orígenes CORS permitidos."""
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    def validate_production(self) -> None:
        """Valida seguridad en producción: nunca debug y secret seguro."""
        if self.environment == "prod":
            if self.debug:
                raise RuntimeError("DEBUG no puede ser true en producción")
            if self.jwt_secret == "cambiar-en-produccion":
                raise RuntimeError("JWT_SECRET no configurado en producción")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Provee la instancia única (cacheada) de la configuración."""
    settings = Settings()
    settings.validate_production()
    return settings
