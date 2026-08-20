"""add_fecha_fin_estimada_ordenes

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-08-11 10:00:00.000000

Agrega la fecha estimada de finalización a las órdenes de producción (fecha
de corte planificada del módulo Gestión de OP; la fecha real de cierre se
sigue registrando en `fecha_fin`).
"""
import sqlalchemy as sa
from alembic import op

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('ordenes_produccion', sa.Column('fecha_fin_estimada', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('ordenes_produccion', 'fecha_fin_estimada')
