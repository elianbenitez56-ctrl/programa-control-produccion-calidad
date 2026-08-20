"""Fábrica de casos de uso del Módulo Autenticación.

Una sola fábrica por petición: todos los repositorios comparten la misma
sesión AsyncSession, de modo que cada transacción es coherente.
"""
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auditoria import AuditoriaUseCases
from app.application.use_cases.auth import (
    ChangePasswordUseCase,
    GetMeUseCase,
    ListSessionsUseCase,
    LoginKioskoUseCase,
    LoginPasswordUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    RevokeSessionUseCase,
)
from app.application.use_cases.configuracion import (
    AreasUseCases,
    MaquinasUseCases,
    PlantasUseCases,
    TurnosUseCases,
)
from app.application.use_cases.inventario import MovimientosUseCases, ProductosUseCases
from app.application.use_cases.produccion import (
    CalidadUseCases,
    OrdenesUseCases,
    ParadasUseCases,
    ProduccionResumenUseCases,
    RegistrosDiariosUseCases,
    TrazabilidadUseCases,
)
from app.application.use_cases.usuarios import (
    CambiarEstadoUsuarioUseCase,
    CrearUsuarioUseCase,
    EditarUsuarioUseCase,
    EliminarUsuarioUseCase,
    ListarRolesUseCase,
    ListarSupervisoresUseCase,
    ListarUsuariosUseCase,
    VerUsuarioUseCase,
)
from app.infrastructure.adapters.clock import SystemClock
from app.infrastructure.adapters.email import LogEmailSender
from app.infrastructure.adapters.security_impl import Argon2PasswordHasher, JwtTokenService
from app.infrastructure.repositories.audit_repo import (
    SqlAuditRepository,
    SqlResetTokenRepository,
)
from app.infrastructure.repositories.configuracion_repo import (
    SqlAreaRepository,
    SqlMaquinaRepository,
    SqlPlantaRepository,
)
from app.infrastructure.repositories.configuracion_repo import (
    SqlTurnoRepository as SqlTurnoConfigRepository,
)
from app.infrastructure.repositories.inventario_repo import (
    SqlMovimientoRepository,
    SqlProductoRepository,
)
from app.infrastructure.repositories.kiosko_repo import SqlKioskoRepository
from app.infrastructure.repositories.produccion_repo import (
    SqlCalidadRepository,
    SqlOrdenProduccionRepository,
    SqlParadaRepository,
    SqlRegistroDiarioRepository,
)
from app.infrastructure.repositories.rol_repo import SqlRolRepository
from app.infrastructure.repositories.sesion_repo import (
    SqlSesionOperarioRepository,
    SqlSesionRepository,
)
from app.infrastructure.repositories.turno_repo import SqlTurnoRepository
from app.infrastructure.repositories.user_repo import SqlUserRepository


@dataclass
class AuthUseCases:
    """Todos los casos de uso coherentes en una transacción."""

    login_password: LoginPasswordUseCase
    login_kiosko: LoginKioskoUseCase
    refresh: RefreshTokenUseCase
    logout: LogoutUseCase
    change_password: ChangePasswordUseCase
    reset_request: RequestPasswordResetUseCase
    reset_password: ResetPasswordUseCase
    list_sessions: ListSessionsUseCase
    revoke_session: RevokeSessionUseCase
    get_me: GetMeUseCase


@dataclass
class UsuariosUseCases:
    """Casos de uso de administración de usuarios (RBAC)."""

    listar: ListarUsuariosUseCase
    ver: VerUsuarioUseCase
    crear: CrearUsuarioUseCase
    editar: EditarUsuarioUseCase
    estado: CambiarEstadoUsuarioUseCase
    eliminar: EliminarUsuarioUseCase
    roles: ListarRolesUseCase
    supervisores: ListarSupervisoresUseCase


@dataclass
class ConfiguracionUseCases:
    """Casos de uso del Módulo Configuración (catálogos por planta)."""

    plantas: PlantasUseCases
    areas: AreasUseCases
    maquinas: MaquinasUseCases
    turnos: TurnosUseCases


@dataclass
class ProduccionUseCases:
    """Casos de uso del módulo Producción (OP como entidad raíz)."""

    ordenes: OrdenesUseCases
    registros: RegistrosDiariosUseCases
    paradas: ParadasUseCases
    calidad: CalidadUseCases
    trazabilidad: TrazabilidadUseCases
    resumen: ProduccionResumenUseCases


@dataclass
class InventarioUseCases:
    """Casos de uso del Módulo Inventario (productos y movimientos)."""

    productos: ProductosUseCases
    movimientos: MovimientosUseCases


def build_auditoria_use_cases(session: AsyncSession) -> AuditoriaUseCases:
    """Construye los casos de uso de Auditoría para la sesión dada."""
    return AuditoriaUseCases(
        SqlAuditRepository(session),
        SqlUserRepository(session),
    )


def _http_meta(request: Request) -> tuple[str | None, str | None, str | None]:
    ip = request.client.host if request.client else None
    dispositivo = request.headers.get("user-agent")
    request_id = getattr(request.state, "request_id", None)
    return ip, dispositivo, request_id


def build_auth_use_cases(session: AsyncSession) -> AuthUseCases:
    """Construye los casos de uso para la sesión dada."""
    users = SqlUserRepository(session)
    roles = SqlRolRepository(session)
    sessions = SqlSesionRepository(session)
    op_sessions = SqlSesionOperarioRepository(session)
    kioskos = SqlKioskoRepository(session)
    turnos = SqlTurnoRepository(session)
    audit = SqlAuditRepository(session)
    resets = SqlResetTokenRepository(session)

    hasher = Argon2PasswordHasher()
    tokens = JwtTokenService()
    clock = SystemClock()

    return AuthUseCases(
        login_password=LoginPasswordUseCase(users, roles, sessions, hasher, tokens, audit, clock),
        login_kiosko=LoginKioskoUseCase(users, roles, sessions, op_sessions, kioskos, turnos,
                                        hasher, tokens, audit, clock),
        refresh=RefreshTokenUseCase(users, roles, sessions, tokens, audit, clock),
        logout=LogoutUseCase(sessions, op_sessions, audit),
        change_password=ChangePasswordUseCase(users, hasher, sessions, audit),
        reset_request=RequestPasswordResetUseCase(users, tokens, LogEmailSender(), audit),
        reset_password=ResetPasswordUseCase(users, tokens, sessions, resets, hasher, audit),
        list_sessions=ListSessionsUseCase(sessions),
        revoke_session=RevokeSessionUseCase(sessions, audit),
        get_me=GetMeUseCase(users, roles),
    )


def build_usuarios_use_cases(session: AsyncSession) -> UsuariosUseCases:
    """Construye los casos de uso de administración para la sesión dada."""
    users = SqlUserRepository(session)
    roles = SqlRolRepository(session)
    audit = SqlAuditRepository(session)
    hasher = Argon2PasswordHasher()
    return UsuariosUseCases(
        listar=ListarUsuariosUseCase(users),
        ver=VerUsuarioUseCase(users),
        crear=CrearUsuarioUseCase(users, roles, hasher, audit),
        editar=EditarUsuarioUseCase(users, roles, hasher, audit),
        estado=CambiarEstadoUsuarioUseCase(users, audit),
        eliminar=EliminarUsuarioUseCase(users, audit),
        roles=ListarRolesUseCase(roles),
        supervisores=ListarSupervisoresUseCase(users, SqlAreaRepository(session)),
    )


def build_configuracion_use_cases(session: AsyncSession) -> ConfiguracionUseCases:
    """Construye los casos de uso de Configuración para la sesión dada."""
    audit = SqlAuditRepository(session)
    return ConfiguracionUseCases(
        plantas=PlantasUseCases(SqlPlantaRepository(session), audit),
        areas=AreasUseCases(SqlAreaRepository(session), SqlPlantaRepository(session), audit),
        maquinas=MaquinasUseCases(
            SqlMaquinaRepository(session), SqlAreaRepository(session),
            SqlPlantaRepository(session), audit,
        ),
        turnos=TurnosUseCases(
            SqlTurnoConfigRepository(session), SqlPlantaRepository(session), audit
        ),
    )


def build_produccion_use_cases(session: AsyncSession) -> ProduccionUseCases:
    """Construye los casos de uso de Producción para la sesión dada."""
    ordenes = SqlOrdenProduccionRepository(session)
    registros = SqlRegistroDiarioRepository(session)
    paradas = SqlParadaRepository(session)
    calidad = SqlCalidadRepository(session)
    audit = SqlAuditRepository(session)
    plantas = SqlPlantaRepository(session)
    areas = SqlAreaRepository(session)
    maquinas = SqlMaquinaRepository(session)
    turnos = SqlTurnoConfigRepository(session)
    usuarios = SqlUserRepository(session)
    productos = SqlProductoRepository(session)
    return ProduccionUseCases(
        ordenes=OrdenesUseCases(
            ordenes, audit, plantas, areas, maquinas, turnos, usuarios,
            registros, paradas, calidad, productos,
        ),
        registros=RegistrosDiariosUseCases(
            registros, ordenes, audit, plantas, areas, maquinas, turnos, usuarios,
        ),
        paradas=ParadasUseCases(paradas, audit),
        calidad=CalidadUseCases(calidad, audit, maquinas, turnos, ordenes),
        trazabilidad=TrazabilidadUseCases(
            ordenes, registros, paradas, calidad, plantas, areas, maquinas, turnos, usuarios,
        ),
        resumen=ProduccionResumenUseCases(registros, paradas, ordenes, calidad, maquinas, usuarios),
    )


def build_inventario_use_cases(session: AsyncSession) -> InventarioUseCases:
    """Construye los casos de uso de Inventario para la sesión dada."""
    audit = SqlAuditRepository(session)
    productos = SqlProductoRepository(session)
    return InventarioUseCases(
        productos=ProductosUseCases(productos, audit),
        movimientos=MovimientosUseCases(
            SqlMovimientoRepository(session), productos, SqlPlantaRepository(session), audit
        ),
    )
