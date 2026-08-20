"""Casos de uso del módulo Auditoría (solo lectura sobre la bitácora).

Cada acción del sistema se registra automáticamente en `bitacora`
(RN-AUD-001). Este módulo expone su consulta con filtros y paginación;
no existe ninguna operación de escritura ni eliminación aquí.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.application.ports.auth_ports import AuditRepository, UserRepository
from app.application.serializers import bitacora_publica


class AuditoriaUseCases:
    """Consulta paginada de la bitácora con nombres de usuario resueltos."""

    def __init__(self, audit: AuditRepository, usuarios: UserRepository) -> None:
        self.audit = audit
        self.usuarios = usuarios

    async def listar(self, modulo: str | None = None, accion: str | None = None,
                     usuario_id: str | None = None,
                     fecha_desde: datetime | None = None,
                     fecha_hasta: datetime | None = None,
                     limit: int = 50, offset: int = 0) -> dict[str, Any]:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        registros, total = await self.audit.listar(
            modulo=modulo, accion=accion, usuario_id=usuario_id,
            fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
            limit=limit, offset=offset,
        )
        usuarios = {
            u.id: u.usuario for u in await self.usuarios.list_all()
        }
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "registros": [
                bitacora_publica(r, usuarios.get(r.usuario_id)) for r in registros
            ],
        }
