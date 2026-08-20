"""Casos de uso del Módulo Inventario.

RN-INV-001: el stock de un producto en una planta nunca queda negativo
(salidas y ajustes negativos se validan contra el saldo actual). El stock se
deriva por agregación de movimientos con signo (entrada > 0, salida < 0,
ajuste libre).
"""
from datetime import date

import pytest
from app.application.ports.configuracion_ports import PlantaRepository
from app.application.ports.inventario_ports import (
    MovimientoRepository,
    ProductoRepository,
    StockLine,
)
from app.application.use_cases.inventario import (
    MovimientoDatos,
    MovimientosUseCases,
    ProductoDatos,
    ProductosUseCases,
)
from app.core.exceptions import BusinessRuleError, ConflictError, EntityNotFoundError
from app.domain.entities.configuracion import Planta
from app.domain.entities.inventario import MovimientoInventario, Producto

from tests.unit.fakes import FakeAuditRepository


class FakeProductoRepository(ProductoRepository):
    def __init__(self, productos: list[Producto] | None = None) -> None:
        self.productos = {p.id: p for p in (productos or [])}
        self._next_id = 100

    async def list_all(self, solo_activos: bool = False) -> list[Producto]:
        return [p for p in self.productos.values() if not solo_activos or p.activo]

    async def get_by_id(self, producto_id: str) -> Producto | None:
        return self.productos.get(producto_id)

    async def get_by_codigo(self, codigo: str) -> Producto | None:
        return next((p for p in self.productos.values() if p.codigo == codigo), None)

    async def create(self, producto: Producto) -> Producto:
        producto.id = f"prd-{self._next_id}"
        self._next_id += 1
        self.productos[producto.id] = producto
        return producto

    async def update(self, producto: Producto) -> None:
        self.productos[producto.id] = producto

    async def set_activo(self, producto_id: str, activo: bool) -> None:
        if producto_id in self.productos:
            self.productos[producto_id].activo = activo


class FakeMovimientoRepository(MovimientoRepository):
    def __init__(self, movimientos: list[MovimientoInventario] | None = None) -> None:
        self.movimientos = list(movimientos or [])
        self._next_id = 1

    async def create(self, movimiento: MovimientoInventario) -> MovimientoInventario:
        movimiento.id = f"mov-{self._next_id}"
        self._next_id += 1
        self.movimientos.append(movimiento)
        return movimiento

    async def list_all(self, producto_id=None, planta_id=None, tipo=None,
                       fecha_desde=None, fecha_hasta=None, limit=50, offset=0):
        rows = [m for m in self.movimientos
                if (producto_id is None or m.producto_id == producto_id)
                and (planta_id is None or m.planta_id == planta_id)
                and (tipo is None or m.tipo == tipo)
                and (fecha_desde is None or m.fecha >= fecha_desde)
                and (fecha_hasta is None or m.fecha <= fecha_hasta)]
        rows = sorted(rows, key=lambda m: m.fecha, reverse=True)
        return rows[offset:offset + limit], len(rows)

    async def stock_por_producto(self, planta_id=None, producto_id=None) -> list[StockLine]:
        acum: dict[tuple[str, str], float] = {}
        for m in self.movimientos:
            if (planta_id is None or m.planta_id == planta_id) and (
                producto_id is None or m.producto_id == producto_id
            ):
                clave = (m.producto_id, m.planta_id)
                acum[clave] = acum.get(clave, 0.0) + m.cantidad
        return [StockLine(producto_id=pid, planta_id=plid, cantidad=cant)
                for (pid, plid), cant in acum.items()]

    async def stock_de(self, producto_id: str, planta_id: str) -> float:
        return sum(m.cantidad for m in self.movimientos
                   if m.producto_id == producto_id and m.planta_id == planta_id)


class FakePlantaRepository(PlantaRepository):
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


PLANTA = Planta(id="p1", codigo="PLT-01", nombre="Planta Demo", pais=None,
                zona_horaria="America/Lima", idioma="es", activo=True)
PLANTA_2 = Planta(id="p2", codigo="PLT-02", nombre="Planta B", pais=None,
                  zona_horaria="America/Lima", idioma="es", activo=True)

def _producto(pid: str = "prd-1", codigo: str = "PAP-A4", activo: bool = True) -> Producto:
    return Producto(id=pid, codigo=codigo, nombre="Papel A4", descripcion=None,
                    unidad="t", activo=activo)


def _productos_uc() -> tuple[ProductosUseCases, FakeProductoRepository, FakeAuditRepository]:
    repo = FakeProductoRepository([_producto(), _producto("prd-2", "PAP-A3", activo=False)])
    audit = FakeAuditRepository()
    return ProductosUseCases(repo, audit), repo, audit


def _movimientos_uc(movs: list[MovimientoInventario] | None = None) -> tuple[
        MovimientosUseCases, FakeMovimientoRepository, FakeAuditRepository]:
    repo = FakeMovimientoRepository(movs)
    audit = FakeAuditRepository()
    return MovimientosUseCases(
        repo, FakeProductoRepository([_producto(), _producto("prd-2", "PAP-A3", activo=False)]),
        FakePlantaRepository([PLANTA, PLANTA_2]), audit,
    ), repo, audit


def _movimiento(tipo: str, cantidad: float, producto_id: str = "prd-1",
                planta_id: str = "p1", motivo: str = "Recepción") -> MovimientoInventario:
    return MovimientoInventario(id="", producto_id=producto_id, planta_id=planta_id,
                                tipo=tipo, cantidad=cantidad, motivo=motivo,
                                referencia=None, fecha=date(2026, 8, 11))


# ------------------------------------------------------------- Productos


async def test_producto_crear_ok_y_audita() -> None:
    uc, repo, audit = _productos_uc()
    result = await uc.crear(ProductoDatos(codigo="PAP-C1", nombre="Cartulina", unidad="t"),
                            "u-adm", "10.0.0.1", "req-1")
    assert result["codigo"] == "PAP-C1"
    assert repo.productos[result["id"]].activo is True
    assert audit.rows[-1]["accion"] == "producto_creado"
    assert audit.rows[-1]["modulo"] == "inventario"


async def test_producto_crear_codigo_duplicado_rechaza() -> None:
    uc, _repo, _audit = _productos_uc()
    with pytest.raises(ConflictError):
        await uc.crear(ProductoDatos(codigo="PAP-A4", nombre="Duplicado"), None, None, None)


async def test_producto_crear_codigo_vacio_rechaza() -> None:
    uc, _repo, _audit = _productos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.crear(ProductoDatos(codigo="  ", nombre="X"), None, None, None)


async def test_producto_editar_ok() -> None:
    uc, repo, audit = _productos_uc()
    result = await uc.editar("prd-1", ProductoDatos(codigo="PAP-A4", nombre="Papel A4 Plus"),
                             "u-adm", None, None)
    assert result["nombre"] == "Papel A4 Plus"
    assert repo.productos["prd-1"].nombre == "Papel A4 Plus"
    assert audit.rows[-1]["accion"] == "producto_editado"
    assert audit.rows[-1]["valor_anterior"]["nombre"] == "Papel A4"


async def test_producto_editar_inexistente_rechaza() -> None:
    uc, _repo, _audit = _productos_uc()
    with pytest.raises(EntityNotFoundError):
        await uc.editar("prd-999", ProductoDatos(codigo="X", nombre="Y"), None, None, None)


async def test_producto_desactivar_audita() -> None:
    uc, repo, audit = _productos_uc()
    await uc.desactivar("prd-1", "u-adm", None, None)
    assert repo.productos["prd-1"].activo is False
    assert audit.rows[-1]["accion"] == "producto_desactivado"


async def test_producto_listar_solo_activos() -> None:
    uc, _repo, _audit = _productos_uc()
    todos = await uc.listar()
    activos = await uc.listar(solo_activos=True)
    assert len(todos) == 2
    assert [p["id"] for p in activos] == ["prd-1"]


# ------------------------------------------------------------- Movimientos


async def test_entrada_aumenta_stock_y_audita() -> None:
    uc, repo, audit = _movimientos_uc()
    result = await uc.registrar(
        MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="entrada",
                        cantidad=10.0, motivo="Recepción de materia prima"),
        "u-adm", None, None,
    )
    assert result["cantidad"] == 10.0
    assert repo.movimientos[0].cantidad == 10.0
    assert await repo.stock_de("prd-1", "p1") == 10.0
    assert audit.rows[-1]["accion"] == "movimiento_creado"
    assert audit.rows[-1]["modulo"] == "inventario"


async def test_salida_dentro_del_saldo_ok() -> None:
    uc, repo, _audit = _movimientos_uc([_movimiento("entrada", 50.0)])
    result = await uc.registrar(
        MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="salida",
                        cantidad=30.0, motivo="Despacho", referencia="OP-2026-0001"),
        "u-adm", None, None,
    )
    assert result["cantidad"] == -30.0
    assert await repo.stock_de("prd-1", "p1") == 20.0


async def test_salida_supera_saldo_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc([_movimiento("entrada", 5.0)])
    with pytest.raises(BusinessRuleError) as exc:
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="salida",
                            cantidad=10.0, motivo="Despacho"),
            "u-adm", None, None,
        )
    assert "negativo" in str(exc.value)


async def test_salida_sin_saldo_previo_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="salida",
                            cantidad=1.0, motivo="Despacho"),
            None, None, None,
        )


async def test_ajuste_negativo_insuficiente_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc([_movimiento("entrada", 2.0)])
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="ajuste",
                            cantidad=-5.0, motivo="Conteo físico"),
            None, None, None,
        )


async def test_ajuste_negativo_con_saldo_ok() -> None:
    uc, repo, _audit = _movimientos_uc([_movimiento("entrada", 10.0)])
    await uc.registrar(
        MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="ajuste",
                        cantidad=-2.0, motivo="Conteo físico"),
        None, None, None,
    )
    assert await repo.stock_de("prd-1", "p1") == 8.0


async def test_ajuste_positivo_ok() -> None:
    uc, repo, _audit = _movimientos_uc()
    await uc.registrar(
        MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="ajuste",
                        cantidad=3.0, motivo="Ajuste de inventario"),
        None, None, None,
    )
    assert await repo.stock_de("prd-1", "p1") == 3.0


async def test_tipo_invalido_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="devolucion",
                            cantidad=1.0, motivo="X"),
            None, None, None,
        )


async def test_cantidad_cero_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="entrada",
                            cantidad=0.0, motivo="X"),
            None, None, None,
        )


async def test_cantidad_negativa_en_entrada_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="entrada",
                            cantidad=-5.0, motivo="X"),
            None, None, None,
        )


async def test_motivo_vacio_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p1", tipo="entrada",
                            cantidad=1.0, motivo="   "),
            None, None, None,
        )


async def test_producto_inexistente_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(EntityNotFoundError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-999", planta_id="p1", tipo="entrada",
                            cantidad=1.0, motivo="X"),
            None, None, None,
        )


async def test_producto_inactivo_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(BusinessRuleError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-2", planta_id="p1", tipo="entrada",
                            cantidad=1.0, motivo="X"),
            None, None, None,
        )


async def test_planta_inexistente_rechaza() -> None:
    uc, _repo, _audit = _movimientos_uc()
    with pytest.raises(EntityNotFoundError):
        await uc.registrar(
            MovimientoDatos(producto_id="prd-1", planta_id="p999", tipo="entrada",
                            cantidad=1.0, motivo="X"),
            None, None, None,
        )


async def test_stock_por_planta_y_producto() -> None:
    uc, _repo, _audit = _movimientos_uc([
        _movimiento("entrada", 10.0, planta_id="p1"),
        _movimiento("salida", -4.0, planta_id="p1"),
        _movimiento("entrada", 7.0, planta_id="p2"),
    ])
    stock = await uc.stock()
    por_planta = {s["planta_id"]: s["cantidad"] for s in stock}
    assert por_planta == {"p1": 6.0, "p2": 7.0}
    assert all(s["producto_codigo"] == "PAP-A4" for s in stock)


async def test_listar_movimientos_paginado_y_filtrado() -> None:
    uc, _repo, _audit = _movimientos_uc([
        _movimiento("entrada", 10.0, producto_id="prd-1"),
        _movimiento("entrada", 5.0, producto_id="prd-2"),
    ])
    result = await uc.listar(producto_id="prd-1", limit=1, offset=0)
    assert result["total"] == 1
    assert len(result["movimientos"]) == 1
    assert result["movimientos"][0]["producto_codigo"] == "PAP-A4"
    vacio = await uc.listar(tipo="ajuste")
    assert vacio["total"] == 0
