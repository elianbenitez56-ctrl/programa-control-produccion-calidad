"""App FastAPI de SIGPC (Módulo 1: Autenticación).

Respuesta de error estándar (arquitectura §8.2):
`{"error": {"code", "message", "details", "request_id"}}`.
"""
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routers.auditoria import router as auditoria_router
from app.api.routers.auth import router as auth_router
from app.api.routers.configuracion import router as configuracion_router
from app.api.routers.inventario import router as inventario_router
from app.api.routers.produccion import router as produccion_router
from app.api.routers.usuarios import router as usuarios_router
from app.core.config import get_settings
from app.core.database import dispose_engine, engine
from app.core.exceptions import DomainError
from app.infrastructure.adapters.rate_limit import RateLimitMiddleware

logger = logging.getLogger("sigpc.api")


def _error_response(status: int, code: str, message: str | None, details: dict | None,
                    request_id: str | None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or {},
                           "request_id": request_id}},
    )


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


async def _domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return _error_response(exc.http_status, exc.code, exc.message, exc.details, _request_id(request))


async def _validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = {"errores": exc.errors()}
    return _error_response(422, "VALIDACION_INVALIDA", "Datos de entrada inválidos",
                           details, _request_id(request))


async def _database_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Evita exponer la conexión y devuelve un error accionable al frontend."""
    logger.error("Error de base de datos request_id=%s", _request_id(request), exc_info=True)
    return _error_response(
        503,
        "BASE_DATOS_NO_DISPONIBLE",
        "La base de datos no está disponible. Verifique la configuración del servidor.",
        {},
        _request_id(request),
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logger.info("SIGPC arrancando environment=%s", settings.environment)
    yield
    await dispose_engine()
    logger.info("SIGPC detenido")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SIGPC API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    app.add_exception_handler(DomainError, _domain_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(SQLAlchemyError, _database_error_handler)
    app.add_exception_handler(OSError, _database_error_handler)

    app.include_router(auth_router, prefix=settings.api_v1_prefix)
    app.include_router(usuarios_router, prefix=settings.api_v1_prefix)
    app.include_router(configuracion_router, prefix=settings.api_v1_prefix)
    app.include_router(produccion_router, prefix=settings.api_v1_prefix)
    app.include_router(inventario_router, prefix=settings.api_v1_prefix)
    app.include_router(auditoria_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict:
        return {"estado": "ok", "servicio": "sigpc-backend"}

    @app.get("/health/ready", response_model=None)
    async def readiness() -> JSONResponse | dict:
        """Indica si la API puede atender operaciones que requieren PostgreSQL."""
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        except (SQLAlchemyError, OSError) as exc:
            logger.warning("Readiness de base de datos fallida: %s", exc)
            return JSONResponse(
                status_code=503,
                content={
                    "estado": "no_disponible",
                    "servicio": "sigpc-backend",
                    "base_datos": "no_disponible",
                },
            )
        return {"estado": "ok", "servicio": "sigpc-backend", "base_datos": "ok"}

    return app


app = create_app()
