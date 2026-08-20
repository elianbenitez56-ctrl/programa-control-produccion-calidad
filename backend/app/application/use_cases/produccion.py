"""Casos de uso del módulo Producción (OP como entidad raíz).

Orquestan el ciclo de vida de las órdenes de producción, el registro diario
por turno, las paradas y las incidencias de calidad. Todo se persiste en las
mismas tablas: Dashboard, Reportes e Indicadores consumen únicamente los
resúmenes agregados de estos casos de uso (sin datos duplicados).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from app.application.ports.auth_ports import AuditRepository, UserRepository
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
from app.application.serializers import (
    incidencia_calidad_publica,
    incidencia_calidad_publica_con_nombres,
    orden_produccion_publica,
    orden_produccion_publica_con_nombres,
    parada_publica,
    registro_diario_publico,
    registro_diario_publico_con_nombres,
)
from app.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    EntityNotFoundError,
    InvalidStateError,
)
from app.domain.entities.produccion import (
    IncidenciaCalidad,
    OrdenProduccion,
    Parada,
    RegistroDiario,
)

_MODULO = "produccion"

_ESTADOS_VALIDOS = ("borrador", "asignada", "en_produccion", "pausada", "finalizada", "cancelada")
_TRANSICIONES: dict[str, tuple[str, ...]] = {
    "borrador": ("asignada",),
    "asignada": ("en_produccion", "cancelada"),
    "en_produccion": ("pausada", "finalizada"),
    "pausada": ("en_produccion", "cancelada"),
    "finalizada": (),
    "cancelada": (),
}
_TIPOS_PARADA = ("planeada", "no_planeada")
_TIPOS_CALIDAD = ("defecto", "inspeccion", "nc")
_ESTADOS_CALIDAD = ("abierta", "en_revision", "cerrada")


# ---------------------------------------------------------- Órdenes (OP)


@dataclass
class OrdenDatos:
    cliente: str
    producto: str
    descripcion: str | None = None
    unidad: str = "t"
    cantidad_planificada: float | None = None
    prioridad: int = 5
    fecha_emision: date | None = None
    fecha_programada: date | None = None
    fecha_fin_estimada: date | None = None
    planta_id: str = ""
    area_id: str = ""
    maquina_id: str = ""
    operario_id: str | None = None
    turno_id: str | None = None


class OrdenesUseCases:
    """Ciclo de vida de la orden de producción (entidad raíz).

    Inyecta los repositorios de catálogo (para resolver nombres y validar que
    la máquina pertenezca al área de la planta) y los repositorios de módulos
    asociados (registros, paradas e incidencias) para la regla de eliminación
    que conserva la trazabilidad.
    """

    def __init__(
        self,
        ordenes: OrdenProduccionRepository,
        audit: AuditRepository,
        plantas: PlantaRepository,
        areas: AreaRepository,
        maquinas: MaquinaRepository,
        turnos: TurnoRepository,
        usuarios: UserRepository,
        registros: RegistroDiarioRepository,
        paradas: ParadaRepository,
        calidad: CalidadRepository,
        productos: ProductoRepository,
    ) -> None:
        self.ordenes = ordenes
        self.audit = audit
        self.plantas = plantas
        self.areas = areas
        self.maquinas = maquinas
        self.turnos = turnos
        self.usuarios = usuarios
        self.registros = registros
        self.paradas = paradas
        self.calidad = calidad
        self.productos = productos

    async def listar(self, planta_id: str | None = None, maquina_id: str | None = None,
                     estado: str | None = None) -> list[dict[str, Any]]:
        if estado and estado not in _ESTADOS_VALIDOS:
            raise BusinessRuleError("ESTADO_OP_INVALIDO",
                                    message="El estado de OP indicado no es válido")
        ordenes = await self.ordenes.list_all(planta_id, maquina_id, estado)
        nombres = await self._nombres_resueltos(ordenes)
        return [orden_produccion_publica_con_nombres(o, nombres.get(o.id))
                for o in ordenes]

    async def ver(self, op_id: str) -> dict[str, Any]:
        orden = await self._get(op_id)
        nombres = await self._nombres_resueltos([orden])
        return orden_produccion_publica_con_nombres(orden, nombres.get(orden.id))

    async def _nombres_resueltos(
        self, ordenes: list[OrdenProduccion],
    ) -> dict[str, dict[str, Any]]:
        """Resuelve los nombres de planta/área/máquina/turno/operario para
        que el frontend "Gestión de Órdenes de Producción" los muestre sin
        consultar el backend por fila."""
        plantas = {p.id: {"planta_nombre": p.nombre} for p in await self.plantas.list_all()}
        areas = {a.id: {"area_nombre": a.nombre} for a in await self.areas.list_all()}
        maquinas = {m.id: {"maquina_nombre": m.nombre} for m in await self.maquinas.list_all()}
        turnos = {t.id: {"turno_nombre": t.nombre} for t in await self.turnos.list_all()}
        usuarios = {
            u.id: {"operario_nombre": f"{u.nombre} {u.apellidos}".strip()}
            for u in await self.usuarios.list_all()
        }
        contexto: dict[str, dict[str, Any]] = {}
        for o in ordenes:
            c: dict[str, Any] = {}
            c.update(plantas.get(o.planta_id, {}))
            c.update(areas.get(o.area_id, {}))
            c.update(maquinas.get(o.maquina_id, {}))
            c.update(turnos.get(o.turno_id or "", {}))
            c.update(usuarios.get(o.operario_id or "", {}))
            contexto[o.id] = c
        return contexto

    async def catalogo(self) -> dict[str, Any]:
        """Catálogos mínimos para el formulario de OP (plantas, áreas,
        máquinas y turnos reales de la BD), accesible con `op:ver`."""
        return {
            "plantas": [{"id": p.id, "codigo": p.codigo, "nombre": p.nombre}
                        for p in await self.plantas.list_all()],
            "areas": [{"id": a.id, "planta_id": a.planta_id, "codigo": a.codigo,
                       "nombre": a.nombre} for a in await self.areas.list_all()],
            "maquinas": [{"id": m.id, "planta_id": m.planta_id, "area_id": m.area_id,
                          "codigo": m.codigo, "nombre": m.nombre}
                         for m in await self.maquinas.list_all()],
            "turnos": [{"id": t.id, "planta_id": t.planta_id, "codigo": t.codigo,
                        "nombre": t.nombre} for t in await self.turnos.list_all()],
            "productos": [{"id": p.id, "codigo": p.codigo, "nombre": p.nombre,
                           "unidad": p.unidad}
                          for p in await self.productos.list_all(solo_activos=True)],
        }

    async def crear(self, datos: OrdenDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        await self._validar_orden(datos)
        numero_op = await self.ordenes.next_numero()
        orden = await self.ordenes.create(OrdenProduccion(
            id="", numero_op=numero_op, cliente=datos.cliente.strip(),
            producto=datos.producto.strip(), descripcion=datos.descripcion,
            unidad=datos.unidad, cantidad_planificada=datos.cantidad_planificada,
            cantidad_producida=0.0, prioridad=datos.prioridad, estado="borrador",
            fecha_emision=datos.fecha_emision or date.today(),
            fecha_programada=datos.fecha_programada,
            fecha_fin_estimada=datos.fecha_fin_estimada,
            planta_id=datos.planta_id,
            area_id=datos.area_id, maquina_id=datos.maquina_id,
            operario_id=datos.operario_id, turno_id=datos.turno_id,
        ))
        await self._audit("op_creada", "orden_produccion", orden.id, None,
                          orden_produccion_publica(orden), usuario_id, ip, request_id)
        return orden_produccion_publica(orden)

    async def editar(self, op_id: str, datos: OrdenDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        await self._validar_orden(datos)
        orden = await self._get(op_id)
        if orden.estado in ("finalizada", "cancelada"):
            raise InvalidStateError(message="No se puede editar una OP finalizada o cancelada")
        anterior = orden_produccion_publica(orden)
        orden.cliente = datos.cliente.strip()
        orden.producto = datos.producto.strip()
        orden.descripcion = datos.descripcion
        orden.unidad = datos.unidad
        orden.cantidad_planificada = datos.cantidad_planificada
        orden.prioridad = datos.prioridad
        orden.fecha_programada = datos.fecha_programada
        orden.fecha_fin_estimada = datos.fecha_fin_estimada
        orden.planta_id = datos.planta_id
        orden.area_id = datos.area_id
        orden.maquina_id = datos.maquina_id
        orden.operario_id = datos.operario_id
        orden.turno_id = datos.turno_id
        await self.ordenes.update(orden)
        await self._audit("op_editada", "orden_produccion", orden.id, anterior,
                          orden_produccion_publica(orden), usuario_id, ip, request_id)
        return orden_produccion_publica(orden)

    async def eliminar(self, op_id: str, usuario_id: str | None,
                       ip: str | None, request_id: str | None) -> None:
        """Elimina físicamente una OP solo si no tiene trazabilidad asociada.

        Si existen registros, paradas o incidencias de calidad, la orden no
        se puede borrar (se anula conservando el historial)."""
        orden = await self._get(op_id)
        asociados = [
            len(await self.registros.list_all(op_id=op_id)),
            len(await self.paradas.list_all(op_id=op_id)),
            len(await self.calidad.list_all(op_id=op_id)),
        ]
        if any(asociados):
            raise BusinessRuleError(
                "OP_CON_TRAZABILIDAD",
                message="No es posible eliminar esta orden porque tiene registros "
                        "asociados. Puedes anularla para conservar la trazabilidad.",
            )
        anterior = orden_produccion_publica(orden)
        await self.ordenes.delete(op_id)
        await self._audit("op_eliminada", "orden_produccion", op_id,
                          anterior, None, usuario_id, ip, request_id)

    async def _validar_orden(self, datos: OrdenDatos) -> None:
        if not datos.cliente or not datos.cliente.strip():
            raise BusinessRuleError("CLIENTE_OBLIGATORIO", message="El cliente es obligatorio")
        if not datos.producto or not datos.producto.strip():
            raise BusinessRuleError("PRODUCTO_OBLIGATORIO", message="El producto es obligatorio")
        if not datos.planta_id or not datos.area_id or not datos.maquina_id:
            raise BusinessRuleError("CONTEXTO_OP_INCOMPLETO",
                                    message="La OP debe tener planta, área y máquina")
        if datos.cantidad_planificada is not None and datos.cantidad_planificada <= 0:
            raise BusinessRuleError("CANTIDAD_INVALIDA",
                                    message="La cantidad planificada debe ser mayor que cero")
        if not (1 <= datos.prioridad <= 10):
            raise BusinessRuleError("PRIORIDAD_INVALIDA",
                                    message="La prioridad debe estar entre 1 y 10")
        fecha_fin = datos.fecha_fin_estimada
        if (fecha_fin is not None and datos.fecha_emision is not None
                and fecha_fin < datos.fecha_emision):
            raise BusinessRuleError("FECHA_FIN_ESTIMADA_INVALIDA",
                                    message="La fecha fin estimada no puede ser anterior "
                                            "a la fecha de emisión")
        if (fecha_fin is not None and datos.fecha_programada is not None
                and fecha_fin < datos.fecha_programada):
            raise BusinessRuleError("FECHA_FIN_ESTIMADA_INVALIDA",
                                    message="La fecha fin estimada no puede ser anterior "
                                            "a la fecha programada")
        planta = await self.plantas.get_by_id(datos.planta_id)
        if planta is None:
            raise BusinessRuleError("PLANTA_INEXISTENTE",
                                    message="La planta indicada no existe")
        area = await self.areas.get_by_id(datos.area_id)
        if area is None:
            raise BusinessRuleError("AREA_INEXISTENTE",
                                    message="El área indicada no existe")
        maquina = await self.maquinas.get_by_id(datos.maquina_id)
        if maquina is None:
            raise BusinessRuleError("MAQUINA_INEXISTENTE",
                                    message="La máquina indicada no existe")
        if area.planta_id != planta.id:
            raise BusinessRuleError("AREA_NO_PERTENECE_A_PLANTA",
                                    message="El área seleccionada no pertenece a la planta")
        if maquina.planta_id != planta.id or maquina.area_id != area.id:
            raise BusinessRuleError(
                "MAQUINA_NO_PERTENECE_AREA",
                message="La máquina seleccionada no pertenece al área de la planta")

    async def cambiar_estado(self, op_id: str, nuevo_estado: str, usuario_id: str | None,
                             ip: str | None, request_id: str | None) -> dict[str, Any]:
        if nuevo_estado not in _ESTADOS_VALIDOS:
            raise BusinessRuleError("ESTADO_OP_INVALIDO",
                                    message="El estado de OP indicado no es válido")
        orden = await self._get(op_id)
        if nuevo_estado not in _TRANSICIONES.get(orden.estado, ()):
            raise InvalidStateError(
                message=f"Transición {orden.estado} → {nuevo_estado} no permitida")
        anterior = orden_produccion_publica(orden)
        orden.estado = nuevo_estado
        ahora = datetime.utcnow()
        if nuevo_estado == "en_produccion":
            orden.fecha_inicio = orden.fecha_inicio or ahora
        if nuevo_estado in ("finalizada", "cancelada"):
            orden.fecha_fin = orden.fecha_fin or ahora
        await self.ordenes.update(orden)
        await self._audit("op_estado_cambiado", "orden_produccion", orden.id, anterior,
                          orden_produccion_publica(orden), usuario_id, ip, request_id)
        return orden_produccion_publica(orden)

    async def _get(self, op_id: str) -> OrdenProduccion:
        orden = await self.ordenes.get_by_id(op_id)
        if orden is None:
            raise EntityNotFoundError("orden_produccion")
        return orden

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# --------------------------------------------------- Registros diarios


@dataclass
class RegistroDatos:
    op_id: str
    fecha: date | None = None
    turno_id: str = ""
    operario_id: str = ""
    planta_id: str = ""
    area_id: str = ""
    maquina_id: str = ""
    produccion_total: float = 0.0
    produccion_buena: float = 0.0
    produccion_rechazada: float = 0.0
    unidad: str = "t"
    hora_inicio: time | None = None
    hora_fin: time | None = None
    tiempo_operativo_min: int | None = None
    observaciones: str | None = None


class RegistrosDiariosUseCases:
    """Captura diaria por turno asociada obligatoriamente a una OP."""

    def __init__(
        self,
        registros: RegistroDiarioRepository,
        ordenes: OrdenProduccionRepository,
        audit: AuditRepository,
        plantas: PlantaRepository,
        areas: AreaRepository,
        maquinas: MaquinaRepository,
        turnos: TurnoRepository,
        usuarios: UserRepository,
    ) -> None:
        self.registros = registros
        self.ordenes = ordenes
        self.audit = audit
        self.plantas = plantas
        self.areas = areas
        self.maquinas = maquinas
        self.turnos = turnos
        self.usuarios = usuarios

    async def listar(self, op_id: str | None = None, fecha: date | None = None,
                     planta_id: str | None = None, area_id: str | None = None,
                     maquina_id: str | None = None, turno_id: str | None = None,
                     operario_id: str | None = None) -> list[dict[str, Any]]:
        registros = await self.registros.list_all(op_id, fecha, planta_id, area_id,
                                                  maquina_id, turno_id, operario_id)
        nombres = await self._nombres_resueltos(registros)
        return [registro_diario_publico_con_nombres(r, nombres.get(r.id))
                for r in registros]

    async def ver(self, registro_id: str) -> dict[str, Any]:
        registro = await self._get(registro_id)
        nombres = await self._nombres_resueltos([registro])
        return registro_diario_publico_con_nombres(registro, nombres.get(registro.id))

    async def _nombres_resueltos(
        self, registros: list[RegistroDiario],
    ) -> dict[str, dict[str, Any]]:
        """Resuelve los nombres de las referencias de cada registro (catálogos
        y OP) para que el frontend "Registros por Área" pueda mostrarlos sin
        volver a consultar el backend por fila."""
        plantas = {p.id: {"planta_nombre": p.nombre} for p in await self.plantas.list_all()}
        areas = {a.id: {"area_nombre": a.nombre} for a in await self.areas.list_all()}
        maquinas = {m.id: {"maquina_nombre": m.nombre} for m in await self.maquinas.list_all()}
        turnos = {t.id: {"turno_nombre": t.nombre} for t in await self.turnos.list_all()}
        usuarios = {
            u.id: {"operario_nombre": f"{u.nombre} {u.apellidos}".strip()}
            for u in await self.usuarios.list_all()
        }
        ordenes = {o.id: o for o in await self.ordenes.list_all()}
        contexto: dict[str, dict[str, Any]] = {}
        for r in registros:
            c: dict[str, Any] = {}
            c.update(plantas.get(r.planta_id, {}))
            c.update(areas.get(r.area_id, {}))
            c.update(maquinas.get(r.maquina_id, {}))
            c.update(turnos.get(r.turno_id, {}))
            c.update(usuarios.get(r.operario_id, {}))
            orden = ordenes.get(r.op_id)
            if orden is not None:
                c["numero_op"] = orden.numero_op
                c["producto"] = orden.producto
                c["cliente"] = orden.cliente
            contexto[r.id] = c
        return contexto

    async def crear(self, datos: RegistroDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_registro(datos)
        orden = await self.ordenes.get_by_id(datos.op_id)
        if orden is None:
            raise EntityNotFoundError("orden_produccion")
        if orden.estado == "finalizada":
            raise BusinessRuleError("OP_FINALIZADA",
                                    message="No se puede registrar producción de una OP finalizada")
        if await self.registros.get_duplicado(datos.op_id, datos.fecha or date.today(),
                                              datos.turno_id) is not None:
            raise ConflictError("REGISTRO_DUPLICADO",
                                message="Ya existe un registro para esa OP, fecha y turno")
        registro = await self.registros.create(RegistroDiario(
            id="", op_id=datos.op_id, fecha=datos.fecha or date.today(),
            turno_id=datos.turno_id, operario_id=datos.operario_id,
            planta_id=datos.planta_id, area_id=datos.area_id, maquina_id=datos.maquina_id,
            produccion_total=datos.produccion_total, produccion_buena=datos.produccion_buena,
            produccion_rechazada=datos.produccion_rechazada, unidad=datos.unidad,
            hora_inicio=datos.hora_inicio, hora_fin=datos.hora_fin,
            tiempo_operativo_min=datos.tiempo_operativo_min, observaciones=datos.observaciones,
        ))
        await self.ordenes.add_produccion(datos.op_id, datos.produccion_total)
        await self._audit("registro_creado", "registro_diario", registro.id, None,
                          registro_diario_publico(registro), usuario_id, ip, request_id)
        return registro_diario_publico(registro)

    async def editar(self, registro_id: str, datos: RegistroDatos, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        _validar_registro(datos)
        registro = await self._get(registro_id)
        anterior = registro_diario_publico(registro)
        orden_anterior = registro.op_id
        registro.op_id = datos.op_id
        registro.fecha = datos.fecha or registro.fecha
        registro.turno_id = datos.turno_id
        registro.operario_id = datos.operario_id
        registro.planta_id = datos.planta_id
        registro.area_id = datos.area_id
        registro.maquina_id = datos.maquina_id
        registro.produccion_total = datos.produccion_total
        registro.produccion_buena = datos.produccion_buena
        registro.produccion_rechazada = datos.produccion_rechazada
        registro.unidad = datos.unidad
        registro.hora_inicio = datos.hora_inicio
        registro.hora_fin = datos.hora_fin
        registro.tiempo_operativo_min = datos.tiempo_operativo_min
        registro.observaciones = datos.observaciones
        await self.registros.update(registro)
        await self.ordenes.add_produccion(orden_anterior, -float(anterior["produccion_total"]))
        await self.ordenes.add_produccion(datos.op_id, datos.produccion_total)
        await self._audit("registro_editado", "registro_diario", registro.id, anterior,
                          registro_diario_publico(registro), usuario_id, ip, request_id)
        return registro_diario_publico(registro)

    async def eliminar(self, registro_id: str, usuario_id: str | None,
                       ip: str | None, request_id: str | None) -> None:
        registro = await self._get(registro_id)
        anterior = registro_diario_publico(registro)
        await self.ordenes.add_produccion(registro.op_id, -registro.produccion_total)
        await self.registros.delete(registro_id)
        await self._audit("registro_eliminado", "registro_diario", registro_id,
                          anterior, None, usuario_id, ip, request_id)

    async def _get(self, registro_id: str) -> RegistroDiario:
        registro = await self.registros.get_by_id(registro_id)
        if registro is None:
            raise EntityNotFoundError("registro_diario")
        return registro

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# -------------------------------------------------------------- Paradas


@dataclass
class ParadaDatos:
    maquina_id: str
    motivo: str
    inicio: datetime | None = None
    tipo: str = "no_planeada"
    op_id: str | None = None
    registro_id: str | None = None
    turno_id: str | None = None
    observacion: str | None = None


class ParadasUseCases:
    """Registro de paradas con duración calculada al cerrar."""

    def __init__(self, paradas: ParadaRepository, audit: AuditRepository) -> None:
        self.paradas = paradas
        self.audit = audit

    async def listar(self, maquina_id: str | None = None, op_id: str | None = None,
                     fecha_inicio: date | None = None, fecha_fin: date | None = None,
                     turno_id: str | None = None) -> list[dict[str, Any]]:
        return [parada_publica(p)
                for p in await self.paradas.list_all(maquina_id, op_id,
                                                     fecha_inicio, fecha_fin, turno_id)]

    async def ver(self, parada_id: str) -> dict[str, Any]:
        parada = await self._get(parada_id)
        return parada_publica(parada)

    async def crear(self, datos: ParadaDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        if not datos.motivo or not datos.motivo.strip():
            raise BusinessRuleError("MOTIVO_PARADA_OBLIGATORIO",
                                    message="El motivo de la parada es obligatorio")
        if datos.tipo not in _TIPOS_PARADA:
            raise BusinessRuleError("TIPO_PARADA_INVALIDO",
                                    message="El tipo de parada debe ser 'planeada' o 'no_planeada'")
        if await self.paradas.get_abierta_en_maquina(datos.maquina_id) is not None:
            raise ConflictError("PARADA_ABIERTA",
                                message="Existe una parada activa en la máquina")
        parada = await self.paradas.create(Parada(
            id="", maquina_id=datos.maquina_id, motivo=datos.motivo.strip(),
            inicio=datos.inicio or datetime.utcnow(), tipo=datos.tipo, op_id=datos.op_id,
            registro_id=datos.registro_id, turno_id=datos.turno_id,
            observacion=datos.observacion,
        ))
        await self._audit("parada_creada", "parada", parada.id, None,
                          parada_publica(parada), usuario_id, ip, request_id)
        return parada_publica(parada)

    async def cerrar(self, parada_id: str, fin: datetime, usuario_id: str | None,
                     ip: str | None, request_id: str | None) -> dict[str, Any]:
        parada = await self._get(parada_id)
        if parada.fin is not None:
            raise ConflictError("PARADA_CERRADA", message="La parada ya está cerrada")
        if fin <= parada.inicio:
            raise BusinessRuleError("PARADA_FIN_INVALIDO",
                                    message="El fin de la parada debe ser posterior al inicio")
        duracion = int((fin - parada.inicio).total_seconds() // 60)
        await self.paradas.cerrar(parada_id, fin, duracion)
        parada.fin = fin
        parada.duracion_min = duracion
        await self._audit("parada_cerrada", "parada", parada.id,
                          {"fin": None}, parada_publica(parada), usuario_id, ip, request_id)
        return parada_publica(parada)

    async def _get(self, parada_id: str) -> Parada:
        parada = await self.paradas.get_by_id(parada_id)
        if parada is None:
            raise EntityNotFoundError("parada")
        return parada

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# --------------------------------------------------------------- Calidad


@dataclass
class IncidenciaDatos:
    maquina_id: str
    tipo: str = "defecto"
    op_id: str | None = None
    registro_id: str | None = None
    codigo: str | None = None
    descripcion: str | None = None
    lote: str | None = None
    cantidad: float | None = None
    turno_id: str | None = None
    fecha: date | None = None


class CalidadUseCases:
    """Incidencias de calidad (defectos, inspecciones, NC)."""

    def __init__(
        self,
        calidad: CalidadRepository,
        audit: AuditRepository,
        maquinas: MaquinaRepository,
        turnos: TurnoRepository,
        ordenes: OrdenProduccionRepository,
    ) -> None:
        self.calidad = calidad
        self.audit = audit
        self.maquinas = maquinas
        self.turnos = turnos
        self.ordenes = ordenes

    async def listar(self, op_id: str | None = None, maquina_id: str | None = None,
                     tipo: str | None = None, fecha_inicio: date | None = None,
                     fecha_fin: date | None = None) -> list[dict[str, Any]]:
        incidencias = await self.calidad.list_all(op_id, maquina_id, tipo,
                                                  fecha_inicio, fecha_fin)
        nombres = await self._nombres_resueltos(incidencias)
        return [incidencia_calidad_publica_con_nombres(i, nombres.get(i.id))
                for i in incidencias]

    async def ver(self, incidencia_id: str) -> dict[str, Any]:
        incidencia = await self._get(incidencia_id)
        nombres = await self._nombres_resueltos([incidencia])
        return incidencia_calidad_publica_con_nombres(incidencia, nombres.get(incidencia.id))

    async def _nombres_resueltos(
        self, incidencias: list[IncidenciaCalidad],
    ) -> dict[str, dict[str, Any]]:
        """Resuelve máquina, turno y datos de la OP para cada incidencia."""
        maquinas = {m.id: {"maquina_nombre": m.nombre} for m in await self.maquinas.list_all()}
        turnos = {t.id: {"turno_nombre": t.nombre} for t in await self.turnos.list_all()}
        ordenes = {o.id: o for o in await self.ordenes.list_all()}
        contexto: dict[str, dict[str, Any]] = {}
        for i in incidencias:
            c: dict[str, Any] = {}
            c.update(maquinas.get(i.maquina_id, {}))
            c.update(turnos.get(i.turno_id, {}))
            orden = ordenes.get(i.op_id or "")
            if orden is not None:
                c["numero_op"] = orden.numero_op
                c["producto"] = orden.producto
                c["cliente"] = orden.cliente
            contexto[i.id] = c
        return contexto

    async def crear(self, datos: IncidenciaDatos, usuario_id: str | None,
                    ip: str | None, request_id: str | None) -> dict[str, Any]:
        if datos.tipo not in _TIPOS_CALIDAD:
            raise BusinessRuleError("TIPO_INCIDENCIA_INVALIDO",
                                    message="El tipo debe ser 'defecto', 'inspeccion' o 'nc'")
        if not datos.descripcion or not datos.descripcion.strip():
            raise BusinessRuleError("DESCRIPCION_OBLIGATORIA",
                                    message="La descripción de la incidencia es obligatoria")
        incidencia = await self.calidad.create(IncidenciaCalidad(
            id="", maquina_id=datos.maquina_id, tipo=datos.tipo, descripcion=datos.descripcion,
            estado="abierta", fecha=datos.fecha or date.today(), op_id=datos.op_id,
            registro_id=datos.registro_id, codigo=datos.codigo, lote=datos.lote,
            cantidad=datos.cantidad, turno_id=datos.turno_id,
        ))
        await self._audit("incidencia_creada", "incidencia_calidad", incidencia.id, None,
                          incidencia_calidad_publica(incidencia), usuario_id, ip, request_id)
        return incidencia_calidad_publica(incidencia)

    async def cambiar_estado(self, incidencia_id: str, nuevo_estado: str,
                             usuario_id: str | None, ip: str | None,
                             request_id: str | None) -> dict[str, Any]:
        if nuevo_estado not in _ESTADOS_CALIDAD:
            raise BusinessRuleError("ESTADO_INCIDENCIA_INVALIDO",
                                    message="Estado de incidencia no válido")
        incidencia = await self._get(incidencia_id)
        anterior = incidencia_calidad_publica(incidencia)
        incidencia.estado = nuevo_estado
        await self.calidad.update(incidencia)
        await self._audit("incidencia_estado", "incidencia_calidad", incidencia.id, anterior,
                          incidencia_calidad_publica(incidencia), usuario_id, ip, request_id)
        return incidencia_calidad_publica(incidencia)

    async def _get(self, incidencia_id: str) -> IncidenciaCalidad:
        incidencia = await self.calidad.get_by_id(incidencia_id)
        if incidencia is None:
            raise EntityNotFoundError("incidencia_calidad")
        return incidencia

    async def _audit(self, accion: str, entidad: str, entidad_id: str,
                     anterior: dict[str, Any] | None, nuevo: dict[str, Any] | None,
                     usuario_id: str | None, ip: str | None, request_id: str | None) -> None:
        await self.audit.record(usuario_id, accion, _MODULO, entidad, entidad_id,
                                anterior, nuevo, ip, None, request_id)


# -------------------------------------------------- Trazabilidad (solo lectura)


class TrazabilidadUseCases:
    """Línea de vida de una OP: registros, paradas e incidencias (solo lectura).

    La trazabilidad se deriva de los datos existentes (no hay tabla de lotes):
    el lote es el identificador libre de las incidencias o un valor derivado
    OP + fecha + turno de los registros diarios.
    """

    def __init__(
        self,
        ordenes: OrdenProduccionRepository,
        registros: RegistroDiarioRepository,
        paradas: ParadaRepository,
        calidad: CalidadRepository,
        plantas: PlantaRepository,
        areas: AreaRepository,
        maquinas: MaquinaRepository,
        turnos: TurnoRepository,
        usuarios: UserRepository,
    ) -> None:
        self.ordenes = ordenes
        self.registros = registros
        self.paradas = paradas
        self.calidad = calidad
        self.plantas = plantas
        self.areas = areas
        self.maquinas = maquinas
        self.turnos = turnos
        self.usuarios = usuarios

    async def buscar(self, op_id: str | None = None, numero_op: str | None = None,
                     lote: str | None = None) -> dict[str, Any]:
        if not (op_id or numero_op or lote):
            raise BusinessRuleError("CRITERIO_TRAZABILIDAD",
                                    message="Indica un id de OP, número de OP o lote a rastrear")
        ordenes = await self._ordenes_buscar(op_id, numero_op, lote)
        if not ordenes:
            return {"total": 0, "resultados": []}
        plantas = {p.id: {"planta_nombre": p.nombre} for p in await self.plantas.list_all()}
        areas = {a.id: {"area_nombre": a.nombre} for a in await self.areas.list_all()}
        maquinas = {m.id: {"maquina_nombre": m.nombre} for m in await self.maquinas.list_all()}
        turnos = {t.id: {"turno_nombre": t.nombre} for t in await self.turnos.list_all()}
        usuarios = {
            u.id: {"operario_nombre": f"{u.nombre} {u.apellidos}".strip()}
            for u in await self.usuarios.list_all()
        }
        resultados: list[dict[str, Any]] = []
        for orden in ordenes:
            contexto_orden: dict[str, Any] = {}
            contexto_orden.update(plantas.get(orden.planta_id, {}))
            contexto_orden.update(areas.get(orden.area_id, {}))
            contexto_orden.update(maquinas.get(orden.maquina_id, {}))
            contexto_orden.update(turnos.get(orden.turno_id, {}))
            if orden.operario_id:
                contexto_orden.update(usuarios.get(orden.operario_id, {}))

            registros = await self.registros.list_all(op_id=orden.id)
            paradas = await self.paradas.list_all(op_id=orden.id)
            incidencias = await self.calidad.list_all(op_id=orden.id)

            registro_ctx = self._nombres_registros(registros, maquinas, turnos, usuarios)
            incidencia_ctx = self._nombres_incidencias(incidencias, maquinas, turnos)

            lotes: set[str] = set()
            for r in registros:
                lotes.add(f"{orden.numero_op}-{r.fecha.isoformat()}-{r.turno_id[:8]}")
            lotes.update(i.lote for i in incidencias if i.lote)

            resultados.append({
                "orden": orden_produccion_publica_con_nombres(orden, contexto_orden),
                "registros": [registro_diario_publico_con_nombres(r, registro_ctx.get(r.id))
                              for r in registros],
                "paradas": [parada_publica(p) for p in paradas],
                "incidencias": [incidencia_calidad_publica_con_nombres(i, incidencia_ctx.get(i.id))
                                for i in incidencias],
                "lotes": sorted(lotes),
            })
        return {"total": len(resultados), "resultados": resultados}

    async def _ordenes_buscar(self, op_id: str | None, numero_op: str | None,
                              lote: str | None) -> list[OrdenProduccion]:
        if op_id:
            orden = await self.ordenes.get_by_id(op_id)
            return [orden] if orden else []
        if numero_op:
            orden = await self.ordenes.get_by_numero(numero_op.strip())
            return [orden] if orden else []
        objetivo = lote.strip().lower()
        incidencias = await self.calidad.list_all()
        ops_id = {i.op_id for i in incidencias if i.lote and i.lote.strip().lower() == objetivo}
        if not ops_id:
            return []
        return [o for o in await self.ordenes.list_all() if o.id in ops_id]

    @staticmethod
    def _nombres_registros(
        registros: list[RegistroDiario],
        maquinas: dict[str, dict[str, Any]],
        turnos: dict[str, dict[str, Any]],
        usuarios: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        contexto: dict[str, dict[str, Any]] = {}
        for r in registros:
            c: dict[str, Any] = {}
            c.update(maquinas.get(r.maquina_id, {}))
            c.update(turnos.get(r.turno_id, {}))
            c.update(usuarios.get(r.operario_id, {}))
            contexto[r.id] = c
        return contexto

    @staticmethod
    def _nombres_incidencias(
        incidencias: list[IncidenciaCalidad],
        maquinas: dict[str, dict[str, Any]],
        turnos: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        contexto: dict[str, dict[str, Any]] = {}
        for i in incidencias:
            c: dict[str, Any] = {}
            c.update(maquinas.get(i.maquina_id, {}))
            c.update(turnos.get(i.turno_id, {}))
            contexto[i.id] = c
        return contexto


# ------------------------------------------------------- Resumen/indicadores


class ProduccionResumenUseCases:
    """Agregados para Dashboard, Reportes e Indicadores (única fuente: registros).

    Todas las vistas consumen estos totales calculados sobre `registros_diarios`,
    `paradas` e `incidencias_calidad`; no existe ninguna tabla de KPIs.
    """

    def __init__(self, registros: RegistroDiarioRepository, paradas: ParadaRepository,
                 ordenes: OrdenProduccionRepository, calidad: CalidadRepository,
                 maquinas: MaquinaRepository, usuarios: UserRepository) -> None:
        self.registros = registros
        self.paradas = paradas
        self.ordenes = ordenes
        self.calidad = calidad
        self.maquinas = maquinas
        self.usuarios = usuarios

    async def resumen(self, fecha: date | None = None, fecha_desde: date | None = None,
                      fecha_hasta: date | None = None, planta_id: str | None = None,
                      area_id: str | None = None, maquina_id: str | None = None,
                      turno_id: str | None = None, op_id: str | None = None) -> dict[str, Any]:
        filtros = {
            "fecha": fecha, "fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta,
            "planta_id": planta_id, "area_id": area_id, "maquina_id": maquina_id,
            "turno_id": turno_id, "op_id": op_id,
        }
        totales = await self.registros.totales(filtros)
        paradas = await self.paradas.list_all(
            maquina_id=maquina_id, op_id=op_id, turno_id=turno_id,
            fecha_inicio=fecha or fecha_desde, fecha_fin=fecha or fecha_hasta,
        )
        paradas_cerradas = [p for p in paradas if p.duracion_min is not None]
        tiempo_parada = sum(p.duracion_min or 0 for p in paradas_cerradas)
        produccion_total = totales["produccion_total"]
        calidad_pct = None
        if produccion_total > 0:
            calidad_pct = round(totales["produccion_buena"] / produccion_total * 100, 2)
        ordenes_activas = len(await self.ordenes.list_all(
            planta_id=planta_id, maquina_id=maquina_id,
            estado="en_produccion",
        ))
        return {
            "registros": totales["registros"],
            "produccion_total": produccion_total,
            "produccion_buena": totales["produccion_buena"],
            "produccion_rechazada": totales["produccion_rechazada"],
            "calidad_pct": calidad_pct,
            "paradas": len(paradas),
            "tiempo_parada_min": tiempo_parada,
            "ordenes_en_produccion": ordenes_activas,
            "unidad": "t",
        }

    async def indicadores(self, fecha_desde: date | None = None,
                          fecha_hasta: date | None = None,
                          planta_id: str | None = None, area_id: str | None = None,
                          maquina_id: str | None = None,
                          turno_id: str | None = None) -> dict[str, Any]:
        """Agregados completos para Dashboard e Indicadores (una sola fuente).

        Devuelve totales, serie diaria, desglose por máquina/operario, estado
        de órdenes e incidencias por tipo, con nombres resueltos de catálogos.
        """
        hoy = date.today()
        desde = fecha_desde or (hoy - timedelta(days=6))
        hasta = fecha_hasta or hoy
        filtros = {
            "fecha_desde": desde, "fecha_hasta": hasta,
            "planta_id": planta_id, "area_id": area_id,
            "maquina_id": maquina_id, "turno_id": turno_id,
        }
        totales = await self.registros.totales(filtros)
        paradas = await self.paradas.list_all(
            maquina_id=maquina_id, turno_id=turno_id, fecha_inicio=desde, fecha_fin=hasta,
        )
        incidencias = await self.calidad.list_all(
            maquina_id=maquina_id, fecha_inicio=desde, fecha_fin=hasta,
        )
        ordenes = await self.ordenes.list_all(planta_id=planta_id, maquina_id=maquina_id)

        produccion_total = totales["produccion_total"]
        calidad_pct = None
        if produccion_total > 0:
            calidad_pct = round(totales["produccion_buena"] / produccion_total * 100, 2)

        tiempo_operativo = int(totales.get("tiempo_operativo_min", 0))
        tiempo_parada = sum(p.duracion_min or 0 for p in paradas if p.duracion_min is not None)
        disponibilidad_pct = None
        if tiempo_operativo + tiempo_parada > 0:
            disponibilidad_pct = round(
                tiempo_operativo / (tiempo_operativo + tiempo_parada) * 100, 2,
            )

        maquinas = {m.id: m for m in await self.maquinas.list_all()}
        usuarios = {u.id: u for u in await self.usuarios.list_all()}

        por_estado: list[dict[str, Any]] = []
        estados: dict[str, int] = {}
        for o in ordenes:
            estados[o.estado] = estados.get(o.estado, 0) + 1
        por_estado = [{"estado": e, "total": n} for e, n in sorted(estados.items())]

        por_tipo: dict[str, int] = {}
        for i in incidencias:
            por_tipo[i.tipo] = por_tipo.get(i.tipo, 0) + 1

        filas_maquina = await self.registros.agrupar_por_maquina(filtros)
        paradas_por_maquina: dict[str, int] = {}
        for p in paradas:
            if p.duracion_min is not None:
                paradas_por_maquina[p.maquina_id] = (
                    paradas_por_maquina.get(p.maquina_id, 0) + p.duracion_min
                )
        por_maquina: list[dict[str, Any]] = []
        for fila in filas_maquina:
            m = maquinas.get(fila["maquina_id"])
            op = int(fila.get("tiempo_operativo_min", 0))
            tp = paradas_por_maquina.get(fila["maquina_id"], 0)
            total = fila["produccion_total"]
            calidad = round(fila["produccion_buena"] / total * 100, 2) if total > 0 else None
            disp = round(op / (op + tp) * 100, 2) if op + tp > 0 else None
            por_maquina.append({
                "maquina_id": fila["maquina_id"],
                "maquina_nombre": m.nombre if m else fila["maquina_id"],
                "maquina_codigo": m.codigo if m else None,
                "registros": fila["registros"],
                "produccion_total": total,
                "produccion_buena": fila["produccion_buena"],
                "produccion_rechazada": fila["produccion_rechazada"],
                "calidad_pct": calidad,
                "tiempo_operativo_min": op,
                "tiempo_parada_min": tp,
                "disponibilidad_pct": disp,
            })

        filas_operario = await self.registros.agrupar_por_operario(filtros)
        por_operario = [
            {
                "operario_id": fila["operario_id"],
                "operario_nombre": (
                    f"{usuarios[fila['operario_id']].nombre} "
                    f"{usuarios[fila['operario_id']].apellidos}".strip()
                    if fila["operario_id"] in usuarios else fila["operario_id"]
                ),
                "registros": fila["registros"],
                "produccion_total": fila["produccion_total"],
                "produccion_buena": fila["produccion_buena"],
            }
            for fila in filas_operario
        ]

        serie = await self.registros.serie_diaria(desde, hasta, filtros)
        serie_diaria = []
        for dia in serie:
            total = dia["produccion_total"]
            serie_diaria.append({
                "fecha": dia["fecha"].isoformat(),
                "produccion_total": total,
                "produccion_buena": dia["produccion_buena"],
                "produccion_rechazada": dia["produccion_rechazada"],
                "calidad_pct": (
                    round(dia["produccion_buena"] / total * 100, 2) if total > 0 else None
                ),
                "tiempo_operativo_min": dia["tiempo_operativo_min"],
            })

        return {
            "desde": desde.isoformat(),
            "hasta": hasta.isoformat(),
            "totales": {
                "registros": totales["registros"],
                "produccion_total": produccion_total,
                "produccion_buena": totales["produccion_buena"],
                "produccion_rechazada": totales["produccion_rechazada"],
                "calidad_pct": calidad_pct,
                "paradas": len(paradas),
                "tiempo_operativo_min": tiempo_operativo,
                "tiempo_parada_min": tiempo_parada,
                "disponibilidad_pct": disponibilidad_pct,
                "ordenes_en_produccion": sum(1 for o in ordenes if o.estado == "en_produccion"),
                "incidencias": len(incidencias),
                "incidencias_nc": por_tipo.get("nc", 0),
            },
            "serie_diaria": serie_diaria,
            "por_maquina": por_maquina,
            "por_operario": por_operario,
            "por_estado": por_estado,
            "incidencias_por_tipo": [
                {"tipo": t, "total": n} for t, n in sorted(por_tipo.items())
            ],
        }


# ---------------------------------------------------------------- Helpers


def _validar_registro(datos: RegistroDatos) -> None:
    if not datos.op_id or not datos.turno_id or not datos.operario_id:
        raise BusinessRuleError("REGISTRO_INCOMPLETO",
                                message="OP, turno y operario son obligatorios")
    if not datos.planta_id or not datos.area_id or not datos.maquina_id:
        raise BusinessRuleError("REGISTRO_INCOMPLETO",
                                message="Planta, área y máquina son obligatorias")
    if datos.produccion_total < 0 or datos.produccion_buena < 0 or datos.produccion_rechazada < 0:
        raise BusinessRuleError("CANTIDADES_NEGATIVAS",
                                message="Las cantidades no pueden ser negativas")
    if datos.produccion_buena + datos.produccion_rechazada > datos.produccion_total:
        raise BusinessRuleError("CANTIDADES_INCOHERENTES",
                                message="Buena + rechazada no puede superar la producción total")
    if datos.hora_inicio and datos.hora_fin and datos.hora_fin <= datos.hora_inicio:
        raise BusinessRuleError("HORARIO_INVALIDO",
                                message="La hora de fin debe ser posterior a la de inicio")
