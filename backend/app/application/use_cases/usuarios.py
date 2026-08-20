"""Casos de uso de administración de usuarios (RBAC).

Orquestan el CRUD de usuarios y la asignación planta/área/máquina/supervisor.
Solo dependen de puertos; la capa API exige los permisos correspondientes.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.application.ports.auth_ports import (
    AuditRepository,
    RolRepository,
    UserRepository,
)
from app.application.ports.configuracion_ports import AreaRepository
from app.application.serializers import usuario_publico
from app.core.exceptions import BusinessRuleError, ConflictError, EntityNotFoundError
from app.domain.entities.auth import User, UserState
from app.domain.rules.credentials import PasswordPolicy


@dataclass
class UsuarioCrear:
    """Datos para crear un usuario."""

    usuario: str
    nombre: str
    apellidos: str
    email: str | None
    codigo: str | None
    documento: str | None
    planta: str | None
    area: str | None
    maquina: str | None
    supervisor: str | None
    rol: str
    estado: str = "activo"


class ListarUsuariosUseCase:
    """Lista todos los usuarios con su rol y asignación (admin)."""

    def __init__(self, users: UserRepository) -> None:
        self.users = users

    async def execute(self) -> list[dict[str, Any]]:
        usuarios = await self.users.list_all()
        return [usuario_publico(u, []) for u in usuarios]


class VerUsuarioUseCase:
    """Detalle de un usuario por id (admin)."""

    def __init__(self, users: UserRepository) -> None:
        self.users = users

    async def execute(self, usuario_id: str) -> dict[str, Any]:
        user = await self.users.get_by_id(usuario_id)
        if user is None:
            raise EntityNotFoundError("usuario")
        return usuario_publico(user, [])


class CrearUsuarioUseCase:
    """Crea un usuario con su rol y asignación."""

    def __init__(
        self,
        users: UserRepository,
        roles: RolRepository,
        hasher: Any,
        audit: AuditRepository,
    ) -> None:
        self.users = users
        self.roles = roles
        self.hasher = hasher
        self.audit = audit

    async def execute(self, datos: UsuarioCrear, credencial: str | None, ip: str | None,
                      request_id: str | None) -> dict[str, Any]:
        if len(datos.usuario) < 4:
            raise BusinessRuleError("USUARIO_CORTO")
        if await self.users.get_by_username(datos.usuario) is not None:
            raise ConflictError("USUARIO_DUPLICADO", message="El nombre de usuario ya existe")
        if datos.email and await self.users.get_by_email(datos.email) is not None:
            raise ConflictError("EMAIL_DUPLICADO", message="El correo ya está en uso")
        if datos.codigo and await self.users.get_by_codigo(datos.codigo) is not None:
            raise ConflictError("CODIGO_DUPLICADO", message="El código de empleado ya existe")

        password_hash = None
        if credencial:
            fallos = PasswordPolicy.validate(credencial)
            if fallos:
                raise BusinessRuleError("PASSWORD_POLITICA_INVALIDA", details={"reglas": fallos})
            password_hash = self.hasher.hash(credencial)

        user = await self.users.create(
            User(
                id="",
                usuario=datos.usuario,
                email=datos.email,
                nombre=datos.nombre,
                apellidos=datos.apellidos,
                estado=UserState(datos.estado),
                codigo=datos.codigo,
                documento=datos.documento,
                planta=datos.planta,
                area=datos.area,
                maquina=datos.maquina,
                supervisor=datos.supervisor,
                password_hash=password_hash,
            )
        )

        planta_id = await self.users.get_planta_id_para(datos.planta)
        if planta_id:
            await self.users.replace_roles(user.id, datos.rol, planta_id)

        await self.audit.record(
            None, "usuario_creado", "identidad", "usuario", user.id,
            None, {"usuario": datos.usuario, "rol": datos.rol}, ip, None, request_id,
        )
        user.roles = await self.roles.get_roles_by_user(user.id)
        return usuario_publico(user, sorted(user.permisos()))


class EditarUsuarioUseCase:
    """Actualiza perfil, asignación, estado y (opcional) contraseña."""

    def __init__(
        self,
        users: UserRepository,
        roles: RolRepository,
        hasher: Any,
        audit: AuditRepository,
    ) -> None:
        self.users = users
        self.roles = roles
        self.hasher = hasher
        self.audit = audit

    async def execute(
        self,
        usuario_id: str,
        datos: UsuarioCrear,
        password_nueva: str | None,
        ip: str | None,
        request_id: str | None,
    ) -> dict[str, Any]:
        user = await self.users.get_by_id(usuario_id)
        if user is None:
            raise EntityNotFoundError("usuario")

        if datos.email:
            existente = await self.users.get_by_email(datos.email)
            if existente is not None and existente.id != usuario_id:
                raise ConflictError("EMAIL_DUPLICADO", message="El correo ya está en uso")

        if datos.codigo:
            existente_codigo = await self.users.get_by_codigo(datos.codigo)
            if existente_codigo is not None and existente_codigo.id != usuario_id:
                raise ConflictError(
                    "CODIGO_DUPLICADO", message="El código de empleado ya existe"
                )

        user.nombre = datos.nombre
        user.apellidos = datos.apellidos
        user.email = datos.email
        user.codigo = datos.codigo
        user.documento = datos.documento
        user.planta = datos.planta
        user.area = datos.area
        user.maquina = datos.maquina
        user.supervisor = datos.supervisor
        user.estado = UserState(datos.estado)
        await self.users.update_profile(user)

        if password_nueva:
            failures = PasswordPolicy.validate(password_nueva)
            if failures:
                raise BusinessRuleError("PASSWORD_POLITICA_INVALIDA", details={"reglas": failures})
            await self.users.update_password_hash(usuario_id, self.hasher.hash(password_nueva))

        planta_id = await self.users.get_planta_id_para(datos.planta)
        if planta_id:
            await self.users.replace_roles(usuario_id, datos.rol, planta_id)

        await self.audit.record(
            None, "usuario_editado", "identidad", "usuario", usuario_id,
            None, {"usuario": datos.usuario, "rol": datos.rol}, ip, None, request_id,
        )
        user.roles = await self.roles.get_roles_by_user(user.id)
        return usuario_publico(user, sorted(user.permisos()))


class CambiarEstadoUsuarioUseCase:
    """Activa/desactiva un usuario."""

    def __init__(self, users: UserRepository, audit: AuditRepository) -> None:
        self.users = users
        self.audit = audit

    async def execute(self, usuario_id: str, estado: UserState, ip: str | None,
                      request_id: str | None) -> dict[str, Any]:
        user = await self.users.get_by_id(usuario_id)
        if user is None:
            raise EntityNotFoundError("usuario")
        user.estado = estado
        await self.users.update_profile(user)
        await self.audit.record(
            None, "usuario_estado", "identidad", "usuario", usuario_id,
            None, {"estado": estado.value}, ip, None, request_id,
        )
        return usuario_publico(user, [])


class EliminarUsuarioUseCase:
    """Elimina un usuario y sus asignaciones de rol."""

    def __init__(self, users: UserRepository, audit: AuditRepository) -> None:
        self.users = users
        self.audit = audit

    async def execute(self, usuario_id: str, ip: str | None, request_id: str | None) -> None:
        user = await self.users.get_by_id(usuario_id)
        if user is None:
            raise EntityNotFoundError("usuario")
        await self.users.delete(usuario_id)
        await self.audit.record(
            None, "usuario_eliminado", "identidad", "usuario", usuario_id,
            None, {"usuario": user.usuario}, ip, None, request_id,
        )


class ListarRolesUseCase:
    """Roles disponibles para asignación (catálogo RBAC).

    Lee el catálogo real `roles` (seed): al agregar un rol nuevo en el
    catálogo aparecerá aquí sin modificar esta estructura.
    """

    def __init__(self, roles: RolRepository) -> None:
        self.roles = roles

    async def execute(self) -> list[dict[str, str]]:
        return [
            {"codigo": r.codigo, "nombre": r.nombre}
            for r in await self.roles.list_all()
        ]


class ListarSupervisoresUseCase:
    """Catálogo de supervisores (usuarios con rol `supervisor`).

    Es la lista consumible por los formularios de producción y calidad
    (registro diario, cierre de turno, captura) para seleccionar el
    supervisor real en lugar de un texto libre. Cada entrada incluye su
    área de supervisión oficial (resuelta de `areas` vía `usuarios.area`).
    """

    def __init__(self, users: UserRepository, areas: AreaRepository) -> None:
        self.users = users
        self.areas = areas

    async def execute(self, solo_activos: bool = True) -> list[dict[str, Any]]:
        supervisores = await self.users.list_supervisores(solo_activos=solo_activos)
        resultado: list[dict[str, Any]] = []
        for s in supervisores:
            area_info: dict[str, str] | None = None
            if s.area:
                planta_id = await self.users.get_planta_id_para(s.planta)
                if planta_id is not None:
                    area = await self.areas.get_by_planta_codigo(planta_id, s.area)
                    if area is not None:
                        area_info = {"id": area.id, "codigo": area.codigo,
                                     "nombre": area.nombre}
            resultado.append(
                {
                    "id": s.id,
                    "codigo": s.codigo,
                    # Formato corporativo: apellidos primero (p. ej.
                    # "ACUÑA ARIZA ROSIRIS ISABEL"), igual que en el catálogo del personal.
                    "nombre": f"{s.apellidos} {s.nombre}".strip(),
                    "estado": s.estado.value,
                    "area": area_info,
                }
            )
        return resultado
