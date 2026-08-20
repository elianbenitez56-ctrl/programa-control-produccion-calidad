"""Pruebas de integración de los endpoints de la API (flujos completos)."""
from datetime import UTC, datetime, time

import pytest
from app.core.security import hash_secret
from app.infrastructure.adapters.security_impl import JwtTokenService
from app.infrastructure.orm.configuracion import (
    Area,
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
from sqlalchemy import select

API = "/api/v1"


async def crear_demo(session) -> dict:
    """Estructura tipo demo: admin + operario + planta + máquina + kiosko + turno."""
    planta = Planta(codigo="PLT-D", nombre="Planta Demo", zona_horaria="America/Mexico_City")
    session.add(planta)
    await session.flush()

    area = Area(planta_id=planta.id, codigo="ARE-D", nombre="Área D")
    session.add(area)
    await session.flush()

    estado = (await session.execute(
        select(__import__("app.infrastructure.orm.configuracion", fromlist=["Estado"]).Estado)
    )).scalars().first()
    if estado is None:
        estado = __import__("app.infrastructure.orm.configuracion", fromlist=["Estado"]).Estado(
            proceso="maquina", codigo="sin_operario", nombre="Sin operario")
        session.add(estado)
        await session.flush()

    maquina = Maquina(planta_id=planta.id, area_id=area.id, codigo="MAQ-D",
                      nombre="Máquina D", tiene_contador=False, tipo_contador="ninguno",
                      estado_actual_id=estado.id)
    session.add(maquina)
    await session.flush()

    kiosko = Kiosko(planta_id=planta.id, maquina_id=maquina.id, codigo="K-D",
                    tipo_ingreso="mixto", token_dispositivo="tok-api-100")
    session.add(kiosko)
    await session.flush()

    turno = Turno(planta_id=planta.id, codigo="T-D", nombre="Turno D",
                  hora_inicio=time(0, 0), hora_fin=time(23, 59))
    session.add(turno)
    await session.flush()
    for dia in range(1, 8):
        session.add(TurnoDia(turno_id=turno.id, dia_semana=dia))
    await session.flush()

    perm_admin = Permiso(codigo="usuario:ver", modulo="identidad", recurso="usuario",
                         accion="ver", descripcion="ver")
    perm_op = Permiso(codigo="op:ver", modulo="produccion", recurso="op", accion="ver",
                      descripcion="ver")
    session.add_all([perm_admin, perm_op])
    rol_admin = Rol(codigo="admin", nombre="Administrador", es_sistema=True)
    rol_op = Rol(codigo="operario", nombre="Operario", es_sistema=True)
    session.add_all([rol_admin, rol_op])
    await session.flush()
    session.add_all([RolPermiso(rol_id=rol_admin.id, permiso_id=perm_admin.id),
                     RolPermiso(rol_id=rol_op.id, permiso_id=perm_op.id)])

    admin = Usuario(usuario="admin", email="admin@test.local", nombre="Admin",
                    apellidos="Test", password_hash=hash_secret("Admin1234"), estado="activo")
    op = Usuario(usuario="operario", email="op@test.local", nombre="Operario",
                 apellidos="Test", pin_hash=hash_secret("1234"), rfid_tag="RFID-API",
                 estado="activo")
    session.add_all([admin, op])
    await session.flush()
    session.add_all([
        UsuarioRol(usuario_id=admin.id, planta_id=planta.id, rol_id=rol_admin.id,
                   vigencia_inicio=datetime.now(UTC).date()),
        UsuarioRol(usuario_id=op.id, planta_id=planta.id, rol_id=rol_op.id,
                   vigencia_inicio=datetime.now(UTC).date()),
    ])
    await session.commit()
    return {"admin": admin, "op": op, "kiosko": kiosko}


async def _id_usuario(session, usuario: str) -> str:
    result = await session.execute(select(Usuario.id).where(Usuario.usuario == usuario))
    return result.scalar_one()


@pytest.mark.integration
async def test_flujo_login_sesiones_y_logout(session, client) -> None:
    await crear_demo(session)

    r = await client.post(f"{API}/auth/login", json={"usuario": "admin", "password": "Admin1234"})
    assert r.status_code == 200, r.text
    access = r.json()["access_token"]
    refresh = r.json()["refresh_token"]

    headers = {"Authorization": f"Bearer {access}"}
    me = await client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["usuario"] == "admin"
    assert "usuario:ver" in me.json()["permisos"]

    sesiones = await client.get(f"{API}/auth/sessions", headers=headers)
    assert sesiones.status_code == 200
    assert len(sesiones.json()["sesiones"]) == 1

    refreshed = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]

    logout = await client.post(f"{API}/auth/logout", json={"refresh_token": refresh},
                               headers=headers)
    assert logout.status_code == 200

    reuso = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
    assert reuso.status_code == 401


@pytest.mark.integration
async def test_login_credenciales_invalidas_formato_error(session, client) -> None:
    await crear_demo(session)
    r = await client.post(f"{API}/auth/login", json={"usuario": "admin", "password": "incorrecta"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTENTICACION_INVALIDA"


@pytest.mark.integration
async def test_me_sin_token_devuelve_401(session, client) -> None:
    await crear_demo(session)
    r = await client.get(f"{API}/auth/me")
    assert r.status_code == 401


@pytest.mark.integration
async def test_login_kiosko_por_rfid(session, client) -> None:
    await crear_demo(session)
    r = await client.post(f"{API}/auth/login/kiosk", json={
        "metodo": "rfid", "credencial": "RFID-API", "kiosko_token": "tok-api-100"})
    assert r.status_code == 200, r.text
    assert r.json()["usuario"]["usuario"] == "operario"
    assert r.json()["sesion_operario"]["maquina_id"] is not None


@pytest.mark.integration
async def test_login_kiosko_pin_con_identificador(session, client) -> None:
    await crear_demo(session)
    r = await client.post(f"{API}/auth/login/kiosk", json={
        "metodo": "pin", "credencial": "1234", "kiosko_token": "tok-api-100",
        "identificador": "operario"})
    assert r.status_code == 200, r.text
    assert r.json()["sesion_operario"]["turno_id"] is not None


@pytest.mark.integration
async def test_login_kiosko_pin_invalido(session, client) -> None:
    await crear_demo(session)
    r = await client.post(f"{API}/auth/login/kiosk", json={
        "metodo": "pin", "credencial": "0000", "kiosko_token": "tok-api-100",
        "identificador": "operario"})
    assert r.status_code == 401


@pytest.mark.integration
async def test_cambio_y_reseteo_de_password(session, client) -> None:
    await crear_demo(session)
    r = await client.post(f"{API}/auth/login", json={"usuario": "admin", "password": "Admin1234"})
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    cambio = await client.post(
        f"{API}/auth/password/change",
        json={"password_actual": "Admin1234", "password_nueva": "NuevaClave1"},
        headers=headers,
    )
    assert cambio.status_code == 200

    vieja = await client.post(
        f"{API}/auth/login", json={"usuario": "admin", "password": "Admin1234"}
    )
    assert vieja.status_code == 401

    # Reset con token fabricado directamente (el envío real usa EmailSender, M1-D2).
    user_id = await _id_usuario(session, "admin")
    try:
        token, _jti = JwtTokenService().create_reset_token(user_id)
        reseteo = await client.post(f"{API}/auth/password/reset",
                                    json={"token": token, "password_nueva": "Reseteada1"})
        assert reseteo.status_code == 200

        nuevo = await client.post(f"{API}/auth/login",
                                  json={"usuario": "admin", "password": "Reseteada1"})
        assert nuevo.status_code == 200
    finally:
        pass


@pytest.mark.integration
async def test_password_forgot_responde_ok_siempre(session, client) -> None:
    await crear_demo(session)
    ok = await client.post(f"{API}/auth/password/forgot",
                           json={"email": "no-existe@sigpc.local"})
    assert ok.status_code == 200
