"""Reglas de eliminación y validación de órdenes de producción.

Regla central (Req. 12): una OP solo puede eliminarse físicamente si no tiene
trazabilidad asociada (registros diarios, paradas o incidencias de calidad);
de lo contrario el dominio rechaza la operación y sugiere anularla. Además se
valida que la máquina pertenezca al área de la planta y la coherencia de la
fecha fin estimada.
"""
from datetime import UTC, date, datetime

import pytest
from app.application.ports.configuracion_ports import (
    AreaRepository,
    MaquinaRepository,
    PlantaRepository,
    TurnoRepository,
)
from app.application.ports.inventario_ports import ProductoRepository
from app.application.ports.produccion_ports import (
    CalidadRepository,
    OrdenProduccionRepository,
    ParadaRepository,
    RegistroDiarioRepository,
)
from app.application.use_cases.produccion import OrdenDatos, OrdenesUseCases
from app.core.exceptions import BusinessRuleError, EntityNotFoundError
from app.domain.entities.configuracion import Area, Maquina, Planta, Turno
from app.domain.entities.inventario import Producto
from app.domain.entities.produccion import (
    IncidenciaCalidad,
    OrdenProduccion,
    Parada,
    RegistroDiario,
)

from tests.unit.fakes import FakeAuditRepository, FakeUserRepository, fake_user


class FakeOrdenesRepository(OrdenProduccionRepository):
    def __init__(self, ordenes: list[OrdenProduccion] | None = None) -> None:
        self.ordenes = {o.id: o for o in (ordenes or [])}
        self.eliminadas: list[str] = []

    async def list_all(self, planta_id=None, maquina_id=None, estado=None):
        return [o for o in self.ordenes.values() if (planta_id is None or o.planta_id == planta_id)
                and (maquina_id is None or o.maquina_id == maquina_id)
                and (estado is None or o.estado == estado)]

    async def get_by_id(self, op_id: str) -> OrdenProduccion | None:
        return self.ordenes.get(op_id)

    async def get_by_numero(self, numero_op: str) -> OrdenProduccion | None:
        return next((o for o in self.ordenes.values() if o.numero_op == numero_op), None)

    async def next_numero(self) -> str:
        return "OP-2026-0009"

    async def create(self, orden: OrdenProduccion) -> OrdenProduccion:
        orden.id = f"op-{len(self.ordenes) + 1}"
        self.ordenes[orden.id] = orden
        return orden

    async def update(self, orden: OrdenProduccion) -> None:
        self.ordenes[orden.id] = orden

    async def add_produccion(self, op_id: str, cantidad: float) -> None:
        if op_id in self.ordenes:
            self.ordenes[op_id].cantidad_producida += cantidad

    async def delete(self, op_id: str) -> None:
        self.ordenes.pop(op_id, None)
        self.eliminadas.append(op_id)


class FakeRegistrosRepository(RegistroDiarioRepository):
    def __init__(self, registros: list[RegistroDiario] | None = None) -> None:
        self.registros = registros or []

    async def list_all(self, op_id=None, fecha=None, planta_id=None, area_id=None,
                       maquina_id=None, turno_id=None, operario_id=None):
        return [r for r in self.registros if op_id is None or r.op_id == op_id]

    async def get_by_id(self, registro_id: str) -> RegistroDiario | None:
        return next((r for r in self.registros if r.id == registro_id), None)

    async def get_duplicado(self, op_id: str, fecha: date, turno_id: str) -> RegistroDiario | None:
        return next((r for r in self.registros
                     if r.op_id == op_id and r.fecha == fecha and r.turno_id == turno_id), None)

    async def create(self, registro: RegistroDiario) -> RegistroDiario:
        self.registros.append(registro)
        return registro

    async def update(self, registro: RegistroDiario) -> None:
        self.registros = [r if r.id != registro.id else registro for r in self.registros]

    async def delete(self, registro_id: str) -> None:
        self.registros = [r for r in self.registros if r.id != registro_id]

    async def totales(self, filtros: dict) -> dict:
        return {"registros": 0, "produccion_total": 0.0,
                "produccion_buena": 0.0, "produccion_rechazada": 0.0,
                "tiempo_operativo_min": 0}

    async def serie_diaria(self, fecha_desde: date, fecha_hasta: date,
                           filtros: dict) -> list[dict]:
        return []

    async def agrupar_por_maquina(self, filtros: dict) -> list[dict]:
        return []

    async def agrupar_por_operario(self, filtros: dict) -> list[dict]:
        return []


class FakeParadasRepository(ParadaRepository):
    def __init__(self, paradas: list[Parada] | None = None) -> None:
        self.paradas = paradas or []

    async def list_all(self, maquina_id=None, op_id=None, fecha_inicio=None,
                       fecha_fin=None, turno_id=None):
        return [p for p in self.paradas if op_id is None or p.op_id == op_id]

    async def get_by_id(self, parada_id: str) -> Parada | None:
        return next((p for p in self.paradas if p.id == parada_id), None)

    async def get_abierta_en_maquina(self, maquina_id: str) -> Parada | None:
        return next((p for p in self.paradas
                     if p.maquina_id == maquina_id and p.fin is None), None)

    async def create(self, parada: Parada) -> Parada:
        self.paradas.append(parada)
        return parada

    async def cerrar(self, parada_id: str, fin: datetime, duracion_min: int) -> None:
        p = await self.get_by_id(parada_id)
        if p:
            p.fin = fin
            p.duracion_min = duracion_min

    async def update(self, parada: Parada) -> None:
        self.paradas = [p if p.id != parada.id else parada for p in self.paradas]


class FakeCalidadRepository(CalidadRepository):
    def __init__(self, incidencias: list[IncidenciaCalidad] | None = None) -> None:
        self.incidencias = incidencias or []

    async def list_all(self, op_id=None, maquina_id=None, tipo=None,
                       fecha_inicio=None, fecha_fin=None):
        return [i for i in self.incidencias if op_id is None or i.op_id == op_id]

    async def get_by_id(self, incidencia_id: str) -> IncidenciaCalidad | None:
        return next((i for i in self.incidencias if i.id == incidencia_id), None)

    async def create(self, incidencia: IncidenciaCalidad) -> IncidenciaCalidad:
        self.incidencias.append(incidencia)
        return incidencia

    async def update(self, incidencia: IncidenciaCalidad) -> None:
        self.incidencias = [i if i.id != incidencia.id else incidencia
                            for i in self.incidencias]


class FakeCatalogoPlanta(PlantaRepository):
    def __init__(self, plantas: list[Planta]) -> None:
        self.plantas = {p.id: p for p in plantas}

    async def list_all(self) -> list[Planta]:
        return list(self.plantas.values())

    async def get_by_id(self, planta_id: str) -> Planta | None:
        return self.plantas.get(planta_id)

    async def get_by_codigo(self, codigo: str) -> Planta | None:
        return next((p for p in self.plantas.values() if p.codigo == codigo), None)

    async def create(self, planta: Planta) -> Planta:
        self.plantas[planta.id] = planta
        return planta

    async def update(self, planta: Planta) -> None:
        self.plantas[planta.id] = planta

    async def set_activo(self, planta_id: str, activo: bool) -> None:
        if planta_id in self.plantas:
            self.plantas[planta_id].activo = activo


class FakeCatalogoArea(AreaRepository):
    def __init__(self, areas: list[Area]) -> None:
        self.areas = {a.id: a for a in areas}

    async def list_all(self) -> list[Area]:
        return list(self.areas.values())

    async def get_by_id(self, area_id: str) -> Area | None:
        return self.areas.get(area_id)

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Area | None:
        return next((a for a in self.areas.values()
                     if a.planta_id == planta_id and a.codigo == codigo), None)

    async def create(self, area: Area) -> Area:
        self.areas[area.id] = area
        return area

    async def update(self, area: Area) -> None:
        self.areas[area.id] = area

    async def set_activo(self, area_id: str, activo: bool) -> None:
        if area_id in self.areas:
            self.areas[area_id].activo = activo


class FakeCatalogoMaquina(MaquinaRepository):
    def __init__(self, maquinas: list[Maquina]) -> None:
        self.maquinas = {m.id: m for m in maquinas}

    async def list_all(self) -> list[Maquina]:
        return list(self.maquinas.values())

    async def get_by_id(self, maquina_id: str) -> Maquina | None:
        return self.maquinas.get(maquina_id)

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Maquina | None:
        return next((m for m in self.maquinas.values()
                     if m.planta_id == planta_id and m.codigo == codigo), None)

    async def estado_inicial_por_defecto(self) -> str | None:
        return None

    async def create(self, maquina: Maquina) -> Maquina:
        self.maquinas[maquina.id] = maquina
        return maquina

    async def update(self, maquina: Maquina) -> None:
        self.maquinas[maquina.id] = maquina

    async def set_activo(self, maquina_id: str, activo: bool) -> None:
        if maquina_id in self.maquinas:
            self.maquinas[maquina_id].activo = activo


class FakeCatalogoTurno(TurnoRepository):
    def __init__(self, turnos: list[Turno]) -> None:
        self.turnos = {t.id: t for t in turnos}

    async def list_all(self) -> list[Turno]:
        return list(self.turnos.values())

    async def get_by_id(self, turno_id: str) -> Turno | None:
        return self.turnos.get(turno_id)

    async def get_by_planta_codigo(self, planta_id: str, codigo: str) -> Turno | None:
        return next((t for t in self.turnos.values()
                     if t.planta_id == planta_id and t.codigo == codigo), None)

    async def create(self, turno: Turno) -> Turno:
        self.turnos[turno.id] = turno
        return turno

    async def update(self, turno: Turno) -> None:
        self.turnos[turno.id] = turno

    async def set_activo(self, turno_id: str, activo: bool) -> None:
        if turno_id in self.turnos:
            self.turnos[turno_id].activo = activo


class FakeProductoRepository(ProductoRepository):
    def __init__(self, productos: list[Producto]) -> None:
        self.productos = {p.id: p for p in productos}

    async def list_all(self, solo_activos: bool = False) -> list[Producto]:
        return [p for p in self.productos.values() if not solo_activos or p.activo]

    async def get_by_id(self, producto_id: str) -> Producto | None:
        return self.productos.get(producto_id)

    async def get_by_codigo(self, codigo: str) -> Producto | None:
        return next((p for p in self.productos.values() if p.codigo == codigo), None)

    async def create(self, producto: Producto) -> Producto:
        self.productos[producto.id] = producto
        return producto

    async def update(self, producto: Producto) -> None:
        self.productos[producto.id] = producto

    async def set_activo(self, producto_id: str, activo: bool) -> None:
        if producto_id in self.productos:
            self.productos[producto_id].activo = activo


PLANTA = Planta(id="p1", codigo="PLT-01", nombre="Planta Demo", pais=None,
                zona_horaria="America/Lima", idioma="es", activo=True)
PLANTA_2 = Planta(id="p2", codigo="PLT-02", nombre="Planta B", pais=None,
                  zona_horaria="America/Lima", idioma="es", activo=True)
AREA_1 = Area(id="a1", planta_id="p1", codigo="ARE-01", nombre="Área A",
              responsable_id=None, activo=True)
AREA_2 = Area(id="a2", planta_id="p1", codigo="ARE-02", nombre="Área B",
              responsable_id=None, activo=True)
AREA_OTRA_PLANTA = Area(id="a3", planta_id="p2", codigo="ARE-03", nombre="Área C",
                        responsable_id=None, activo=True)
MAQUINA_1 = Maquina(id="m1", planta_id="p1", area_id="a1", codigo="MAQ-01",
                    nombre="Máquina 1", tiene_contador=False, tipo_contador="ninguno",
                    velocidad_maxima=None, config_contador=None, parametros=None,
                    estado_actual_id="", activo=True)
MAQUINA_OTRA_AREA = Maquina(id="m2", planta_id="p1", area_id="a2", codigo="MAQ-02",
                            nombre="Máquina 2", tiene_contador=False, tipo_contador="ninguno",
                            velocidad_maxima=None, config_contador=None, parametros=None,
                            estado_actual_id="", activo=True)


def _orden(op_id: str = "op-1", numero: str = "OP-2026-0001") -> OrdenProduccion:
    return OrdenProduccion(
        id=op_id, numero_op=numero, cliente="Cliente A", producto="Papel A4",
        descripcion=None, unidad="t", cantidad_planificada=100.0, cantidad_producida=0.0,
        prioridad=5, estado="borrador", fecha_emision=date(2026, 8, 10),
        fecha_programada=date(2026, 8, 12), fecha_fin_estimada=date(2026, 8, 15),
        planta_id="p1", area_id="a1", maquina_id="m1", operario_id=None, turno_id=None,
    )


def _uc(ordenes: list[OrdenProduccion] | None = None,
        registros: list[RegistroDiario] | None = None,
        paradas: list[Parada] | None = None,
        incidencias: list[IncidenciaCalidad] | None = None) -> OrdenesUseCases:
    usuarios = FakeUserRepository()
    usuarios.add(fake_user(id="u-adm", usuario="admin"))
    return OrdenesUseCases(
        ordenes=FakeOrdenesRepository(ordenes),
        audit=FakeAuditRepository(),
        plantas=FakeCatalogoPlanta([PLANTA, PLANTA_2]),
        areas=FakeCatalogoArea([AREA_1, AREA_2, AREA_OTRA_PLANTA]),
        maquinas=FakeCatalogoMaquina([MAQUINA_1, MAQUINA_OTRA_AREA]),
        turnos=FakeCatalogoTurno([]),
        usuarios=usuarios,
        registros=FakeRegistrosRepository(registros),
        paradas=FakeParadasRepository(paradas),
        calidad=FakeCalidadRepository(incidencias),
        productos=FakeProductoRepository([]),
    )


def _datos() -> OrdenDatos:
    return OrdenDatos(
        cliente="Cliente A", producto="Papel A4", unidad="t",
        cantidad_planificada=100.0, prioridad=5, fecha_emision=date(2026, 8, 10),
        fecha_programada=date(2026, 8, 12), fecha_fin_estimada=date(2026, 8, 15),
        planta_id="p1", area_id="a1", maquina_id="m1",
    )


# ---------------------------------------------------------- Eliminación


async def test_eliminar_orden_sin_asociados() -> None:
    uc = _uc(ordenes=[_orden()])
    await uc.eliminar("op-1", "u-adm", None, None)
    assert await uc.ordenes.get_by_id("op-1") is None
    acciones = [r["accion"] for r in uc.audit.rows]
    assert "op_eliminada" in acciones


async def test_eliminar_orden_con_registros_rechaza() -> None:
    uc = _uc(ordenes=[_orden()], registros=[RegistroDiario(
        id="rd-1", op_id="op-1", fecha=date(2026, 8, 10), turno_id="t1",
        operario_id="u-op", planta_id="p1", area_id="a1", maquina_id="m1",
        produccion_total=10.0, produccion_buena=9.0, produccion_rechazada=1.0,
        unidad="t",
    )])
    with pytest.raises(BusinessRuleError) as exc:
        await uc.eliminar("op-1", "u-adm", None, None)
    assert "tiene registros asociados" in str(exc.value)
    assert await uc.ordenes.get_by_id("op-1") is not None


async def test_eliminar_orden_con_parada_rechaza() -> None:
    uc = _uc(ordenes=[_orden()], paradas=[Parada(
        id="pd-1", maquina_id="m1", motivo="Cambio de formato", inicio=datetime.now(UTC),
        op_id="op-1",
    )])
    with pytest.raises(BusinessRuleError):
        await uc.eliminar("op-1", "u-adm", None, None)


async def test_eliminar_orden_con_incidencia_rechaza() -> None:
    uc = _uc(ordenes=[_orden()], incidencias=[IncidenciaCalidad(
        id="ic-1", maquina_id="m1", tipo="defecto", descripcion="Rayado",
        estado="abierta", fecha=date(2026, 8, 10), op_id="op-1",
    )])
    with pytest.raises(BusinessRuleError):
        await uc.eliminar("op-1", "u-adm", None, None)


async def test_eliminar_orden_inexistente() -> None:
    uc = _uc()
    with pytest.raises(EntityNotFoundError):
        await uc.eliminar("op-999", "u-adm", None, None)


# ----------------------------------------------------------- Validación


async def test_validar_maquina_de_otro_area_rechaza() -> None:
    uc = _uc()
    datos = _datos()
    datos.maquina_id = "m2"
    with pytest.raises(BusinessRuleError) as exc:
        await uc.crear(datos, "u-adm", None, None)
    assert "no pertenece al área" in str(exc.value)


async def test_validar_area_de_otra_planta_rechaza() -> None:
    uc = _uc()
    datos = _datos()
    datos.area_id = "a3"
    with pytest.raises(BusinessRuleError) as exc:
        await uc.crear(datos, "u-adm", None, None)
    assert "no pertenece a la planta" in str(exc.value)


async def test_validar_fecha_fin_estimada_anterior_a_emision_rechaza() -> None:
    uc = _uc()
    datos = _datos()
    datos.fecha_fin_estimada = date(2026, 8, 1)
    with pytest.raises(BusinessRuleError) as exc:
        await uc.crear(datos, "u-adm", None, None)
    assert "fecha fin estimada" in str(exc.value)


async def test_validar_fecha_fin_estimada_anterior_a_programada_rechaza() -> None:
    uc = _uc()
    datos = _datos()
    datos.fecha_fin_estimada = date(2026, 8, 11)
    with pytest.raises(BusinessRuleError) as exc:
        await uc.crear(datos, "u-adm", None, None)
    assert "fecha fin estimada" in str(exc.value)


async def test_crear_orden_valida_y_nombra_referencias() -> None:
    uc = _uc()
    creada = await uc.crear(_datos(), "u-adm", None, None)
    assert creada["numero_op"] == "OP-2026-0009"
    assert creada["estado"] == "borrador"
    assert creada["fecha_fin_estimada"] == "2026-08-15"

    lista = await uc.listar()
    assert lista[0]["planta_nombre"] == "Planta Demo"
    assert lista[0]["area_nombre"] == "Área A"
    assert lista[0]["maquina_nombre"] == "Máquina 1"
    assert lista[0]["avance"] == 0.0


async def test_catalogo_expone_catalogos_de_bd() -> None:
    uc = _uc()
    catalogo = await uc.catalogo()
    assert catalogo["plantas"][0]["nombre"] == "Planta Demo"
    assert catalogo["areas"][0]["planta_id"] == "p1"
    assert catalogo["maquinas"][0]["area_id"] == "a1"
    assert catalogo["turnos"] == []
