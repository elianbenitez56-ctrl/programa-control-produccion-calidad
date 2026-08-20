"""Seed idempotente del Módulo 1 (ejecutar tras `alembic upgrade head`).

Carga:
- Catálogo de permisos (matriz RN §18) y roles estándar.
- Estados base de `sesion_operario` y `maquina`.
- Planta demo, área, máquina, kiosko, turnos (para login de kiosko).
- Usuario admin (contraseña desde env SIGPC_ADMIN_PASSWORD, default dev).
- Usuario operario demo con PIN (1234), RFID y QR.

Todo es re-ejecutable: hace upsert por código natural.
"""
import asyncio
import sys
import uuid
from datetime import date, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_secret
from app.infrastructure.catalog.rbac_catalog import all_permisos, all_roles
from app.infrastructure.orm.configuracion import (
    Area,
    Estado,
    Kiosko,
    Maquina,
    Planta,
    Turno,
    TurnoDia,
)
from app.infrastructure.orm.identidad import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from app.infrastructure.orm.produccion import OrdenProduccion
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession


def _uuid() -> str:
    return str(uuid.uuid4())


async def _scalar(session: AsyncSession, stmt):
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _get_by(session: AsyncSession, model, **filtros):
    stmt = select(model).where(*[getattr(model, k) == v for k, v in filtros.items()])
    return await _scalar(session, stmt)


async def _create(session: AsyncSession, model, **campos):
    obj = model(**campos)
    session.add(obj)
    await session.flush()
    return obj


async def seed(session: AsyncSession) -> None:
    settings = get_settings()

    # 1. Permisos
    for p in all_permisos():
        if await _get_by(session, Permiso, codigo=p.codigo) is None:
            await _create(session, Permiso, id=_uuid(), codigo=p.codigo,
                          modulo=p.modulo, recurso=p.recurso, accion=p.accion,
                          descripcion=p.descripcion)

    permisos = (await session.execute(select(Permiso))).scalars().all()
    permisos_por_codigo = {p.codigo: p for p in permisos}

    # 2. Roles con sus permisos (mantenimiento explícito de rol_permisos)
    roles_por_codigo: dict[str, Rol] = {}
    for r in all_roles():
        rol = await _get_by(session, Rol, codigo=r.codigo)
        if rol is None:
            rol = await _create(session, Rol, id=_uuid(), codigo=r.codigo,
                                nombre=r.nombre, descripcion=r.descripcion,
                                es_sistema=True)
        codigos_objetivo = [c for c in r.permisos if c in permisos_por_codigo]
        rows = (await session.execute(
            select(RolPermiso.permiso_id).where(RolPermiso.rol_id == rol.id)
        )).scalars().all()
        if set(rows) != {permisos_por_codigo[c].id for c in codigos_objetivo}:
            await session.execute(delete(RolPermiso).where(RolPermiso.rol_id == rol.id))
            for c in codigos_objetivo:
                session.add(RolPermiso(rol_id=rol.id, permiso_id=permisos_por_codigo[c].id))
        roles_por_codigo[r.codigo] = rol
    await session.flush()

    # 3. Estados (catálogo de procesos)
    estados = [
        ("sesion_operario", "activa", "Activa"),
        ("sesion_operario", "cerrada", "Cerrada"),
        ("maquina", "sin_operario", "Sin operario"),
        ("maquina", "operando", "Operando"),
        ("maquina", "sin_orden", "Sin orden"),
        ("maquina", "lista", "Lista"),
        ("maquina", "preparacion", "Preparación"),
        ("maquina", "produciendo", "Produciendo"),
        ("maquina", "parada", "Parada"),
        ("maquina", "mantenimiento", "En mantenimiento"),
        ("maquina", "offline", "Fuera de línea"),
    ]
    for proceso, codigo, nombre in estados:
        if await _get_by(session, Estado, proceso=proceso, codigo=codigo) is None:
            await _create(session, Estado, id=_uuid(), proceso=proceso,
                          codigo=codigo, nombre=nombre)

    # 4. Plantas (demo + INAPEL + MARFIL para asignación de usuarios)
    planta = await _get_by(session, Planta, codigo="PLT-01")
    if planta is None:
        planta = await _create(session, Planta, id=_uuid(), codigo="PLT-01",
                               nombre="Planta Demo", zona_horaria="America/Mexico_City",
                               idioma="es")

    for codigo_planta, nombre_planta in (("INAPEL", "INAPEL"), ("MARFIL", "MARFIL")):
        if await _get_by(session, Planta, codigo=codigo_planta) is None:
            await _create(session, Planta, id=_uuid(), codigo=codigo_planta,
                          nombre=nombre_planta, zona_horaria="America/Mexico_City",
                          idioma="es")

    area = await _get_by(session, Area, planta_id=planta.id, codigo="ARE-01")
    if area is None:
        area = await _create(session, Area, id=_uuid(), planta_id=planta.id,
                             codigo="ARE-01", nombre="Área A")

    estado_maquina = await _get_by(session, Estado, proceso="maquina", codigo="sin_operario")
    maquina = await _get_by(session, Maquina, planta_id=planta.id, codigo="MAQ-01")
    if maquina is None:
        maquina = await _create(session, Maquina, id=_uuid(), planta_id=planta.id,
                                area_id=area.id, codigo="MAQ-01", nombre="Máquina 1",
                                tiene_contador=True, tipo_contador="manual",
                                estado_actual_id=estado_maquina.id)

    kiosko = await _get_by(session, Kiosko, planta_id=planta.id, codigo="K-01")
    if kiosko is None:
        await _create(session, Kiosko, id=_uuid(), planta_id=planta.id,
                      maquina_id=maquina.id, codigo="K-01", tipo_ingreso="mixto",
                      token_dispositivo="kiosko-demo-0001", ubicacion="Planta 1")

    turno = await _get_by(session, Turno, planta_id=planta.id, codigo="T1")
    if turno is None:
        turno = await _create(session, Turno, id=_uuid(), planta_id=planta.id,
                              codigo="T1", nombre="Turno 1",
                              hora_inicio=time(6, 0), hora_fin=time(14, 0))
        for dia in range(1, 8):
            await _create(session, TurnoDia, id=_uuid(), turno_id=turno.id,
                          dia_semana=dia)

    # 4b. Catálogo corporativo real (alineado con frontend/config/plantas.ts):
    # por cada planta (INAPEL/MARFIL) se crean las áreas (nivel de supervisión)
    # y las máquinas con los códigos que usa el MES ("sm-74", "chm-01").
    # INAPEL usa los nombres oficiales de área de supervisión del corporativo;
    # los supervisores se asocian a estas áreas vía `usuarios.area` (código).
    catalogo = {
        "INAPEL": [("LIT-01", "LITOGRAFIA", "sm-74", "SM 74"),
                   ("FLE-01", "FLEXOGRAFIA", None, None),
                   ("CON-01", "CONVERSION Y ARGOLLADO", "chm-01", "CHM-01"),
                   ("LIB-01", "LIBROS Y EDITORIALES", None, None)],
        "MARFIL": [("LIT-01", "Litografía", "sm-74", "SM 74"),
                   ("CON-01", "Convertidoras", "chm-01", "CHM-01")],
    }
    estado_maquina_inicial = await _get_by(session, Estado, proceso="maquina", codigo="lista")
    if estado_maquina_inicial is None:
        estado_maquina_inicial = await _get_by(session, Estado, proceso="maquina",
                                               codigo="sin_operario")
    maquinas_corporativas: dict[str, Maquina] = {}
    for codigo_planta, _nombre in (("INAPEL", "INAPEL"), ("MARFIL", "MARFIL")):
        planta_cat = await _get_by(session, Planta, codigo=codigo_planta)
        if planta_cat is None:
            continue
        for codigo_area, nombre_area, codigo_maq, nombre_maq in catalogo[codigo_planta]:
            area_cat = await _get_by(session, Area, planta_id=planta_cat.id, codigo=codigo_area)
            if area_cat is None:
                area_cat = await _create(session, Area, id=_uuid(),
                                         planta_id=planta_cat.id, codigo=codigo_area,
                                         nombre=nombre_area)
            elif area_cat.nombre != nombre_area:
                area_cat.nombre = nombre_area
            if codigo_maq is None:
                continue
            maquina_cat = await _get_by(session, Maquina, planta_id=planta_cat.id,
                                        codigo=codigo_maq)
            if maquina_cat is None:
                maquina_cat = await _create(session, Maquina, id=_uuid(),
                                            planta_id=planta_cat.id, area_id=area_cat.id,
                                            codigo=codigo_maq, nombre=nombre_maq,
                                            tiene_contador=True, tipo_contador="manual",
                                            estado_actual_id=estado_maquina_inicial.id)
            maquinas_corporativas[f"{codigo_planta}:{codigo_maq}"] = maquina_cat

    # 4c. Órdenes de producción demo (entidad raíz del MES)
    if await _get_by(session, OrdenProduccion, numero_op="OP-2026-0001") is None:
        planta_inapel = await _get_by(session, Planta, codigo="INAPEL")
        sm74 = maquinas_corporativas.get("INAPEL:sm-74")
        if planta_inapel is not None and sm74 is not None:
            await _create(session, OrdenProduccion, id=_uuid(),
                          numero_op="OP-2026-0001",
                          cliente="Cervezas del Norte", producto="Etiqueta Premium 12x10cm",
                          unidad="t", cantidad_planificada=12, prioridad=5,
                          estado="asignada", fecha_emision=date(2026, 8, 3),
                          fecha_programada=date(2026, 8, 10),
                          planta_id=planta_inapel.id, area_id=sm74.area_id,
                          maquina_id=sm74.id)
    if await _get_by(session, OrdenProduccion, numero_op="OP-2026-0002") is None:
        planta_marfil = await _get_by(session, Planta, codigo="MARFIL")
        chm01 = maquinas_corporativas.get("MARFIL:chm-01")
        if planta_marfil is not None and chm01 is not None:
            await _create(session, OrdenProduccion, id=_uuid(),
                          numero_op="OP-2026-0002",
                          cliente="Grupo Procesos", producto="Bobina retardante 60cm",
                          descripcion="Lote piloto", unidad="t", cantidad_planificada=8,
                          prioridad=3, estado="borrador", fecha_emision=date(2026, 8, 4),
                          fecha_programada=date(2026, 8, 11),
                          planta_id=planta_marfil.id, area_id=chm01.area_id,
                          maquina_id=chm01.id)

    # 5. Admin (rol admin) — password desde env
    admin = await _get_by(session, Usuario, usuario=settings.sigpc_admin_usuario)
    if admin is None:
        admin = await _create(
            session, Usuario, id=_uuid(),
            usuario=settings.sigpc_admin_usuario,
            email=settings.sigpc_admin_email,
            nombre="Administrador", apellidos="Sistema",
            password_hash=hash_secret(settings.sigpc_admin_password),
            estado="activo")
    admin.documento = admin.documento or "1000000000"
    admin.planta = admin.planta or "inapel"
    admin.area = admin.area or "litografia"
    admin.maquina = admin.maquina or "sm-74"
    admin.supervisor = admin.supervisor or "J. Torres"

    asignacion = await _get_by(session, UsuarioRol, usuario_id=admin.id,
                               planta_id=planta.id, rol_id=roles_por_codigo["admin"].id)
    if asignacion is None:
        await _create(session, UsuarioRol, id=_uuid(), usuario_id=admin.id,
                      planta_id=planta.id, rol_id=roles_por_codigo["admin"].id,
                      vigencia_inicio=date.today(), vigencia_fin=None, activo=True)

    # 6. Operario demo (PIN 1234 + password Operario123, RFID, QR) con rol operario
    operario = await _get_by(session, Usuario, usuario="operario1")
    if operario is None:
        operario = await _create(
            session, Usuario, id=_uuid(), usuario="operario1",
            email="operario1@sigpc.local", nombre="Operario", apellidos="Demo",
            pin_hash=hash_secret("1234"), rfid_tag="RFID-0001",
            qr_secret=str(uuid.uuid4()), estado="activo")
    operario.password_hash = operario.password_hash or hash_secret("Operario123")
    operario.documento = operario.documento or "1000000001"
    operario.planta = operario.planta or "inapel"
    operario.area = operario.area or "convertidoras"
    operario.maquina = operario.maquina or "chm-01"
    operario.supervisor = operario.supervisor or "J. Torres"

    asignacion_op = await _get_by(session, UsuarioRol, usuario_id=operario.id,
                                  planta_id=planta.id,
                                  rol_id=roles_por_codigo["operario"].id)
    if asignacion_op is None:
        await _create(session, UsuarioRol, id=_uuid(), usuario_id=operario.id,
                      planta_id=planta.id, rol_id=roles_por_codigo["operario"].id,
                      vigencia_inicio=date.today(), vigencia_fin=None, activo=True)

    # 7. Supervisores de producción y calidad (rol supervisor, planta INAPEL).
    # Se crean por código de empleado (upsert): el código es el identificador
    # corporativo y el nombre completo se parte en nombre/apellidos.
    # `usuarios.area` guarda el CÓDIGO del área de supervisión oficial
    # (áreas INAPEL de 4b): LIB-01, FLE-01, LIT-01, CON-01.
    password_supervisor = settings.sigpc_supervisor_password
    planta_supervisor = await _get_by(session, Planta, codigo="INAPEL") or planta
    supervisores_cat = [
        ("1000", "ACUÑA ARIZA", "ROSIRIS ISABEL", "LIB-01"),
        ("1018", "CARDONA CORDERO", "ELIANA LUCIA", "FLE-01"),
        ("1062", "LINERO ORTEGA", "ALBERTO LUIS", "LIT-01"),
        ("1050", "HERNANDEZ MARQUEZ", "WENDIS YOLANYS", "CON-01"),
        ("1098", "RODRIGUEZ QUIROZ", "GRAFFER GENNER", "FLE-01"),
    ]
    for codigo, apellidos, nombre, codigo_area in supervisores_cat:
        sup = await _get_by(session, Usuario, codigo=codigo)
        if sup is None:
            sup = await _create(
                session, Usuario, id=_uuid(),
                usuario=f"sup.{codigo}", codigo=codigo,
                nombre=nombre, apellidos=apellidos,
                password_hash=hash_secret(password_supervisor),
                email=f"sup.{codigo}@sigpc.local",
                estado="activo",
                planta="inapel", area=codigo_area, maquina="sm-74",
                supervisor=f"{nombre} {apellidos}")
        sup.supervisor = sup.supervisor or f"{nombre} {apellidos}"
        sup.planta = sup.planta or "inapel"
        sup.area = codigo_area
        sup.maquina = sup.maquina or "sm-74"
        asignacion_sup = await _get_by(
            session, UsuarioRol, usuario_id=sup.id,
            planta_id=planta_supervisor.id, rol_id=roles_por_codigo["supervisor"].id)
        if asignacion_sup is None:
            await _create(session, UsuarioRol, id=_uuid(), usuario_id=sup.id,
                          planta_id=planta_supervisor.id,
                          rol_id=roles_por_codigo["supervisor"].id,
                          vigencia_inicio=date.today(), vigencia_fin=None, activo=True)

    await session.flush()


async def main() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        await seed(session)
        await session.commit()
    print(f"Seed completado: {'SQLite demo' if settings.demo_mode else 'PostgreSQL'}")


if __name__ == "__main__":
    asyncio.run(main())
