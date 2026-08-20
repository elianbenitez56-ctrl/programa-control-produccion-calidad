"""usuarios_rbac_asignacion

Revision ID: 9e2a2c4d5e6
Revises: 7240d839b810
Create Date: 2026-08-06 12:00:00.000000

Agrega los campos de asignación del operario a `usuarios` (RBAC):
documento, planta, área, máquina y supervisor. La planta/autorización de rol
sigue utilizando `usuarios_roles` (FK a `plantas.id`); estas columnas
almacenan las referencias textuales (ids de catálogo frontend/MES) para que el
login identifique automáticamente el puesto de trabajo.
"""
import sqlalchemy as sa
from alembic import op

revision = '9e2a2c4d5e6'
down_revision = '7240d839b810'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('documento', sa.String(length=40), nullable=True))
    op.add_column('usuarios', sa.Column('planta', sa.String(length=60), nullable=True))
    op.add_column('usuarios', sa.Column('area', sa.String(length=60), nullable=True))
    op.add_column('usuarios', sa.Column('maquina', sa.String(length=60), nullable=True))
    op.add_column('usuarios', sa.Column('supervisor', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('usuarios', 'supervisor')
    op.drop_column('usuarios', 'maquina')
    op.drop_column('usuarios', 'area')
    op.drop_column('usuarios', 'planta')
    op.drop_column('usuarios', 'documento')
