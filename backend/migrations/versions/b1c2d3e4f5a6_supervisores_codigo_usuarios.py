"""supervisores_codigo_usuarios

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-10 10:00:00.000000

Agrega `codigo` (código de empleado, p. ej. 1000, 1018) a `usuarios`. Los
supervisores de producción y calidad son usuarios con rol `supervisor`; el
código es su identificador corporativo y queda UQ (NULL permitido para
usuarios que no son colaboradores de planta).
"""
import sqlalchemy as sa
from alembic import op

revision = 'b1c2d3e4f5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('codigo', sa.String(length=20), nullable=True))
    op.create_unique_constraint('uq_usuarios_codigo', 'usuarios', ['codigo'])


def downgrade() -> None:
    op.drop_constraint('uq_usuarios_codigo', 'usuarios', type_='unique')
    op.drop_column('usuarios', 'codigo')
