"""Pruebas de integración de los repositorios SQLAlchemy contra PostgreSQL."""
from datetime import UTC, datetime, time, timedelta

import pytest
from sqlalchemy import func, select

from app.core.security import hash_secret
from app.domain.entities.auth import LoginMethod, SesionOperario as DomSesion
from app.infrastructure.orm.bitacora import Bitacora
from app.infrastructure.orm.configuracion import (
    Area,
    Estado,
    Kiosko,
    Maquina,
    Planta,
    Turno,
    TurnoDia,
)
from app.infrastructure.orm.identidad import (
    Permiso,
    Rol,
    RolPermiso,
    Usuario,
    UsuarioRol,
)
from app.infrastructure.repositories.audit_repo import (
    SqlAuditRepository,
    SqlResetTokenRepository,
)
from app.infrastructure.repositories.kiosko_repo import SqlKioskoRepository
from app.infrastructure.repositories.rol_repo import SqlRolRepository
from app.infrastructure.repositories.sesion_repo import (
    SqlSesionOperarioRepository,
    SqlSesionRepository,
)
from app.infrastructure.repositories.turno_repo import SqlTurnoRepository
from app.infrastructure.repositories.user_repo import SqlUserRepository


async def crear_estructura(session) -> dict:
    """Planta + área + máquina + kiosko + turnos + estados."""
    planta = Planta(codigo="PLT-T", nombre="Planta Test", zona_horaria="America/Mexico_City")
    session.add(planta)
    await session.flush()

    area = Area(planta_id=planta.id, codigo="ARE-T", nombre="Área T")
    session.add(area)
    await session.flush()

    estado = Estado(proceso="maquina", codigo="sin_operario", nombre="Sin operario")
    session.add(estado)
    await session.flush()

    maquina = Maquina(planta_id=planta.id, area_id=area.id, codigo="MAQ-T",
                      nombre="Máquina T", tiene_contador=False, tipo_contador="ninguno",
                      estado_actual_id=estado.id)
    session.add(maquina)
    await session.flush()

    kiosko = Kiosko(planta_id=planta.id, maquina_id=maquina.id, codigo="K-T",
                    tipo_ingreso="mixto", token_dispositivo="tok-integracion")
    session.add(kiosko)
    await session.flush()

    turno = Turno(planta_id=planta.id, codigo="T-T", nombre="Turno T",
                  hora_inicio=time(6, 0), hora_fin=time(14, 0))
    session.add(turno)
    await session.flush()
    for dia in range(1, 8):
        session.add(TurnoDia(turno_id=turno.id, dia_semana=dia))
    await session.flush()

    return {"planta": planta, "maquina": maquina, "kiosko": kiosko, "turno": turno}


async def crear_usuario_con_rol(session, estructura, *, usuario="op-t", pin="1234") -> Usuario:
    """Usuario operario con permiso `op:ver` y asignación vigente."""
    permiso = Permiso(codigo="op:ver", modulo="produccion", recurso="op", accion="ver",
                      descripcion="ver ops")
    session.add(permiso)
    rol = Rol(codigo="operario", nombre="Operario", es_sistema=True)
    session.add(rol)
    await session.flush()
    session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))

    user = Usuario(usuario=usuario, email=f"{usuario}@test.local", nombre="Op",
                   apellidos="Test", pin_hash=hash_secret(pin), estado="activo")
    session.add(user)
    await session.flush()
    session.add(UsuarioRol(usuario_id=user.id, planta_id=estructura["planta"].id,
                           rol_id=rol.id, vigencia_inicio=datetime.now(UTC).date()))
    await session.flush()
    return user


@pytest.mark.integration
async def test_repo_usuario_por_identificador_y_lockout(session) -> None:
    est = await crear_estructura(session)
    user = await crear_usuario_con_rol(session, est)
    await session.commit()

    repo = SqlUserRepository(session)
    encontrado = await repo.get_by_identifier("op-t")
    assert encontrado is not None and encontrado.id == user.id
    assert await repo.get_by_identifier("no-existe") is None

    for _ in range(5):
        intentos = await repo.record_failed_login(user.id)
    assert intentos == 5
    bloqueado = await repo.get_by_id(user.id)
    assert bloqueado is not None and bloqueado.extra.get("bloqueado_hasta") is not None

    await repo.reset_login_attempts(user.id)
    reset = await repo.get_by_id(user.id)
    assert reset is not None and reset.extra.get("bloqueado_hasta") is None


@pytest.mark.integration
async def test_repo_roles_devuelve_solo_activos_vigentes(session) -> None:
    est = await crear_estructura(session)
    user = await crear_usuario_con_rol(session, est)
    rol2 = Rol(codigo="supervisor", nombre="Supervisor", es_sistema=True)
    session.add(rol2)
    await session.flush()
    session.add(UsuarioRol(usuario_id=user.id, planta_id=est["planta"].id, rol_id=rol2.id,
                           vigencia_inicio=datetime.now(UTC).date() - timedelta(days=30),
                           vigencia_fin=datetime.now(UTC).date() - timedelta(days=1)))
    await session.commit()

    repo = SqlRolRepository(session)
    roles = await repo.get_roles_by_user(user.id)
    assert [r.codigo for r in roles] == ["operario"]
    assert "op:ver" in {p.codigo for p in roles[0].permisos}


@pytest.mark.integration
async def test_repo_sesiones_autenticacion(session) -> None:
    est = await crear_estructura(session)
    user = await crear_usuario_con_rol(session, est)
    await session.commit()

    repo = SqlSesionRepository(session)
    sesion = await repo.create(user.id, "hash-refresh-1",
                               datetime.now(UTC) + timedelta(days=7), "1.2.3.4", "ua", "jti-1")
    assert sesion.id
    assert (await repo.get_by_refresh_hash("hash-refresh-1")) is not None

    await repo.revoke_by_jti("jti-1")
    assert (await repo.get_by_refresh_hash("hash-refresh-1")).revocada
    assert await repo.list_active_by_user(user.id) == []


@pytest.mark.integration
async def test_repo_sesiones_operario(session) -> None:
    est = await crear_estructura(session)
    user = await crear_usuario_con_rol(session, est)
    await session.commit()

    repo = SqlSesionOperarioRepository(session)
    dom = DomSesion(id="", usuario_id=user.id, maquina_id=est["maquina"].id,
                    turno_id=est["turno"].id, kiosko_id=est["kiosko"].id,
                    metodo_acceso=LoginMethod.PIN, hora_inicio=datetime.now(UTC),
                    hora_fin=None, motivo_cierre=None, estado="activa",
                    planta_id=est["planta"].id)
    creada = await repo.create(dom)
    assert creada.id

    activa = await repo.get_active_for_user(user.id)
    assert activa is not None and activa.maquina_id == est["maquina"].id

    await repo.close_active_for_user(user.id, "logout")
    assert await repo.get_active_for_user(user.id) is None


@pytest.mark.integration
async def test_repo_kiosko_y_turnos(session) -> None:
    est = await crear_estructura(session)
    await session.commit()

    kioskos = SqlKioskoRepository(session)
    k = await kioskos.get_by_token("tok-integracion")
    assert k is not None
    assert k["maquina_id"] == est["maquina"].id
    assert await kioskos.get_by_token("token-invalido") is None

    turnos = SqlTurnoRepository(session)
    lista = await turnos.get_turnos_vigentes(est["planta"].id)
    assert len(lista) == 1
    assert lista[0].dias_semana == frozenset(range(1, 8))
    assert lista[0].hora_inicio == time(6, 0)


@pytest.mark.integration
async def test_repo_auditoria_y_token_reset_single_use(session) -> None:
    est = await crear_estructura(session)
    user = await crear_usuario_con_rol(session, est)
    await session.commit()

    audit = SqlAuditRepository(session)
    await audit.record(user.id, "login_password", "auth", "usuario", user.id,
                       None, {"metodo": "password"}, "ip", "ua", "req-1")
    await session.commit()

    resets = SqlResetTokenRepository(session)
    assert await resets.mark_used("jti-unico") is True
    await session.commit()
    assert await resets.mark_used("jti-unico") is False

    total = (
        await session.execute(select(func.count()).select_from(Bitacora))
    ).scalar()
    assert total >= 2