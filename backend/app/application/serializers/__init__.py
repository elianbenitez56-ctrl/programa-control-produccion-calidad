"""Serializadores de respuesta (vista pública).

Incluye el Módulo Configuración (plantas, áreas, máquinas, turnos), el
módulo Producción (órdenes, registros diarios, paradas, incidencias) y el
Módulo Inventario (productos y movimientos de stock).
"""
from datetime import date, datetime, time
from typing import Any

from app.domain.entities.auth import User
from app.domain.entities.configuracion import Area, Maquina, Planta, Turno
from app.domain.entities.inventario import MovimientoInventario, Producto
from app.domain.entities.produccion import (
    IncidenciaCalidad,
    OrdenProduccion,
    Parada,
    RegistroDiario,
)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else None


def usuario_publico(user: User, permisos: list[str]) -> dict[str, Any]:
    """Perfil del usuario expuesto a la API (login, refresh, /auth/me).

    Incluye la asignación (planta, área, máquina, supervisor) para que el
    frontend identifique automáticamente el puesto de trabajo del operario.
    """
    return {
        "id": user.id,
        "usuario": user.usuario,
        "email": user.email,
        "nombre": user.nombre,
        "apellidos": user.apellidos,
        "codigo": user.codigo,
        "documento": user.documento,
        "estado": user.estado.value,
        "planta": user.planta,
        "area": user.area,
        "maquina": user.maquina,
        "supervisor": user.supervisor,
        "roles": [r.codigo for r in user.roles],
        "permisos": permisos,
        "ultima_conexion": _iso(user.extra.get("ultima_conexion")),
        "fecha_creacion": _iso(user.created_at),
    }


def planta_publica(planta: Planta) -> dict[str, Any]:
    """Vista pública de una planta (tenant)."""
    return {
        "id": planta.id,
        "codigo": planta.codigo,
        "nombre": planta.nombre,
        "pais": planta.pais,
        "zona_horaria": planta.zona_horaria,
        "idioma": planta.idioma,
        "activo": planta.activo,
        "fecha_creacion": _iso(planta.created_at),
    }


def area_publica(area: Area) -> dict[str, Any]:
    """Vista pública de un área de planta."""
    return {
        "id": area.id,
        "planta_id": area.planta_id,
        "codigo": area.codigo,
        "nombre": area.nombre,
        "responsable_id": area.responsable_id,
        "activo": area.activo,
        "fecha_creacion": _iso(area.created_at),
    }


def maquina_publica(maquina: Maquina) -> dict[str, Any]:
    """Vista pública de una máquina (recurso productivo)."""
    return {
        "id": maquina.id,
        "planta_id": maquina.planta_id,
        "area_id": maquina.area_id,
        "codigo": maquina.codigo,
        "nombre": maquina.nombre,
        "tiene_contador": maquina.tiene_contador,
        "tipo_contador": maquina.tipo_contador,
        "velocidad_maxima": maquina.velocidad_maxima,
        "config_contador": maquina.config_contador,
        "parametros": maquina.parametros,
        "estado_actual_id": maquina.estado_actual_id,
        "activo": maquina.activo,
        "fecha_creacion": _iso(maquina.created_at),
    }


def turno_publico(turno: Turno) -> dict[str, Any]:
    """Vista pública de un turno (bloque horario)."""
    return {
        "id": turno.id,
        "planta_id": turno.planta_id,
        "codigo": turno.codigo,
        "nombre": turno.nombre,
        "hora_inicio": turno.hora_inicio.isoformat(),
        "hora_fin": turno.hora_fin.isoformat(),
        "dias_semana": turno.dias_semana,
        "activo": turno.activo,
        "fecha_creacion": _iso(turno.created_at),
    }


# ------------------------------------------------------------- Producción


def _dia(value: date | None) -> str | None:
    return value.isoformat() if isinstance(value, date) else None


def _hora(value: time | None) -> str | None:
    return value.isoformat() if isinstance(value, time) else None


def _avance(orden: OrdenProduccion) -> float | None:
    """Porcentaje de avance de la orden (producida vs planificada, tope 100)."""
    plan = orden.cantidad_planificada
    if not plan or plan <= 0:
        return None
    return round(min(100.0, orden.cantidad_producida / plan * 100), 1)


def orden_produccion_publica(orden: OrdenProduccion) -> dict[str, Any]:
    """Vista pública de una orden de producción (entidad raíz del MES)."""
    return {
        "id": orden.id,
        "numero_op": orden.numero_op,
        "cliente": orden.cliente,
        "producto": orden.producto,
        "descripcion": orden.descripcion,
        "unidad": orden.unidad,
        "cantidad_planificada": orden.cantidad_planificada,
        "cantidad_producida": orden.cantidad_producida,
        "prioridad": orden.prioridad,
        "estado": orden.estado,
        "fecha_emision": _dia(orden.fecha_emision),
        "fecha_programada": _dia(orden.fecha_programada),
        "fecha_fin_estimada": _dia(orden.fecha_fin_estimada),
        "avance": _avance(orden),
        "planta_id": orden.planta_id,
        "area_id": orden.area_id,
        "maquina_id": orden.maquina_id,
        "operario_id": orden.operario_id,
        "turno_id": orden.turno_id,
        "fecha_inicio": _iso(orden.fecha_inicio),
        "fecha_fin": _iso(orden.fecha_fin),
        "fecha_creacion": _iso(orden.created_at),
    }


def orden_produccion_publica_con_nombres(
    orden: OrdenProduccion,
    nombres: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Vista pública de una orden con nombres resueltos de sus referencias.

    `nombres` agrega planta/área/máquina (nombres y códigos), operario y
    turno para el módulo "Gestión de Órdenes de Producción" del frontend.
    """
    base = orden_produccion_publica(orden)
    if nombres:
        base.update(nombres)
    return base


def registro_diario_publico(registro: RegistroDiario) -> dict[str, Any]:
    """Vista pública de un registro diario (captura por turno de una OP)."""
    return {
        "id": registro.id,
        "op_id": registro.op_id,
        "fecha": _dia(registro.fecha),
        "turno_id": registro.turno_id,
        "operario_id": registro.operario_id,
        "planta_id": registro.planta_id,
        "area_id": registro.area_id,
        "maquina_id": registro.maquina_id,
        "hora_inicio": _hora(registro.hora_inicio),
        "hora_fin": _hora(registro.hora_fin),
        "produccion_total": registro.produccion_total,
        "produccion_buena": registro.produccion_buena,
        "produccion_rechazada": registro.produccion_rechazada,
        "unidad": registro.unidad,
        "tiempo_operativo_min": registro.tiempo_operativo_min,
        "observaciones": registro.observaciones,
        "fecha_creacion": _iso(registro.created_at),
    }


def registro_diario_publico_con_nombres(
    registro: RegistroDiario,
    nombres: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Vista pública de un registro con nombres resueltos de sus referencias.

    `nombres` agrega planta/área/máquina/operario/turno (nombres) y los
    datos de la OP (numero_op, producto, cliente) para el módulo
    "Registros por Área" del frontend.
    """
    base = registro_diario_publico(registro)
    if nombres:
        base.update(nombres)
    return base


def parada_publica(parada: Parada) -> dict[str, Any]:
    """Vista pública de una parada (tiempo improductivo)."""
    return {
        "id": parada.id,
        "op_id": parada.op_id,
        "registro_id": parada.registro_id,
        "maquina_id": parada.maquina_id,
        "turno_id": parada.turno_id,
        "motivo": parada.motivo,
        "tipo": parada.tipo,
        "inicio": parada.inicio.isoformat(),
        "fin": parada.fin.isoformat() if parada.fin else None,
        "duracion_min": parada.duracion_min,
        "observacion": parada.observacion,
        "fecha_creacion": _iso(parada.created_at),
    }


def incidencia_calidad_publica(incidencia: IncidenciaCalidad) -> dict[str, Any]:
    """Vista pública de una incidencia de calidad."""
    return {
        "id": incidencia.id,
        "op_id": incidencia.op_id,
        "registro_id": incidencia.registro_id,
        "maquina_id": incidencia.maquina_id,
        "tipo": incidencia.tipo,
        "codigo": incidencia.codigo,
        "descripcion": incidencia.descripcion,
        "lote": incidencia.lote,
        "cantidad": incidencia.cantidad,
        "estado": incidencia.estado,
        "fecha": _dia(incidencia.fecha),
        "turno_id": incidencia.turno_id,
        "fecha_creacion": _iso(incidencia.created_at),
    }


def incidencia_calidad_publica_con_nombres(
    incidencia: IncidenciaCalidad,
    nombres: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Vista pública de una incidencia con nombres resueltos de sus referencias.

    `nombres` agrega máquina y turno (nombres) y los datos de la OP
    (numero_op, producto, cliente) para el módulo "Calidad" del frontend.
    """
    base = incidencia_calidad_publica(incidencia)
    if nombres:
        base.update(nombres)
    return base


def bitacora_publica(registro: Any, username: str | None = None) -> dict[str, Any]:
    """Vista pública de un registro de la bitácora (módulo Auditoría)."""
    return {
        "id": registro.id,
        "usuario_id": registro.usuario_id,
        "username": username or "—",
        "accion": registro.accion,
        "modulo": registro.modulo,
        "entidad": registro.entidad,
        "entidad_id": registro.entidad_id,
        "valor_anterior": registro.valor_anterior,
        "valor_nuevo": registro.valor_nuevo,
        "ip": registro.ip,
        "dispositivo": registro.dispositivo,
        "fecha": _iso(registro.fecha),
    }


# ------------------------------------------------------------ Inventario


def producto_publico(producto: Producto) -> dict[str, Any]:
    """Vista pública de un producto del catálogo (referencia global)."""
    return {
        "id": producto.id,
        "codigo": producto.codigo,
        "nombre": producto.nombre,
        "descripcion": producto.descripcion,
        "unidad": producto.unidad,
        "activo": producto.activo,
        "fecha_creacion": _iso(producto.created_at),
    }


def movimiento_inventario_publico(
    movimiento: MovimientoInventario,
    nombres: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Vista pública de un movimiento de inventario (stock con signo).

    `nombres` agrega producto (codigo, nombre, unidad) y planta (codigo,
    nombre) para el módulo "Inventario" del frontend.
    """
    base = {
        "id": movimiento.id,
        "producto_id": movimiento.producto_id,
        "planta_id": movimiento.planta_id,
        "tipo": movimiento.tipo,
        "cantidad": movimiento.cantidad,
        "referencia": movimiento.referencia,
        "motivo": movimiento.motivo,
        "fecha": _dia(movimiento.fecha),
        "fecha_creacion": _iso(movimiento.created_at),
    }
    if nombres:
        base.update(nombres)
    return base
