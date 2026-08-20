"""Seguridad de eliminación de registros de producción (permiso `op:eliminar`).

Regla: la eliminación de registros diarios solo la puede ejecutar un rol con
el permiso `op:eliminar`. En la matriz RBAC ese permiso lo tiene únicamente
ADMINISTRADOR (que hereda todos los permisos del catálogo).
"""
from app.infrastructure.catalog.rbac_catalog import all_permisos, all_roles


def _permisos_de(rol_codigo: str) -> set[str]:
    for rol in all_roles():
        if rol.codigo == rol_codigo:
            return set(rol.permisos)
    raise AssertionError(f"Rol {rol_codigo} no existe en la matriz")

def test_permiso_eliminar_existe_en_catalogo() -> None:
    permisos = {p.codigo for p in all_permisos()}
    assert "op:eliminar" in permisos

def test_admin_puede_eliminar_registros() -> None:
    assert "op:eliminar" in _permisos_de("admin")

def test_operario_no_puede_eliminar_registros() -> None:
    permisos = _permisos_de("operario")
    assert "op:eliminar" not in permisos
    # al llamar manualmente al endpoint DELETE el backend lo rechaza porque
    # el JWT del operario no trae el permiso exigido por require_permiso
    assert "op:iniciar" in permisos  # conserva lo que sí le corresponde

def test_otros_roles_no_eliminan() -> None:
    for codigo in ("calidad", "supervisor", "gerencia", "auditoria"):
        assert "op:eliminar" not in _permisos_de(codigo), codigo
