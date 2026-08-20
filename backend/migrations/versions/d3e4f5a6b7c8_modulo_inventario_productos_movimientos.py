"""modulo_inventario_productos_movimientos

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-11 10:00:00.000000

Crea el módulo de Inventario (FASE 2): catálogo global de `productos`
(referencias) y `movimientos_inventario` que mueven stock por producto y
planta. `cantidad` es con signo: entrada > 0, salida < 0 y ajuste libre;
el stock disponible se deriva por agregación (SUM(cantidad) por
producto+planta), sin duplicar datos.
"""
import sqlalchemy as sa
from alembic import op

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def _audit_cols() -> list[sa.Column]:
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.BigInteger(), server_default='1', nullable=False),
    ]


def upgrade() -> None:
    op.create_table('productos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('descripcion', sa.String(length=255), nullable=True),
        sa.Column('unidad', sa.String(length=10), server_default='t', nullable=False),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        *_audit_cols(),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_productos')),
        sa.UniqueConstraint('codigo', name=op.f('uq_productos_codigo'))
    )

    op.create_table('movimientos_inventario',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('producto_id', sa.String(length=36), nullable=False),
        sa.Column('planta_id', sa.String(length=36), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('cantidad', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('referencia', sa.String(length=30), nullable=True),
        sa.Column('motivo', sa.String(length=120), nullable=False),
        sa.Column('fecha', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        *_audit_cols(),
        sa.CheckConstraint("tipo IN ('entrada','salida','ajuste')", name=op.f('ck_movimientos_inventario_ck_movimientos_inventario_tipo')),
        sa.CheckConstraint('cantidad <> 0', name=op.f('ck_movimientos_inventario_ck_movimientos_inventario_cantidad_no_cero')),
        sa.CheckConstraint("(tipo <> 'entrada' OR cantidad > 0) AND (tipo <> 'salida' OR cantidad < 0)", name=op.f('ck_movimientos_inventario_ck_movimientos_inventario_signo')),
        sa.ForeignKeyConstraint(['planta_id'], ['plantas.id'], name=op.f('fk_movimientos_inventario_planta_id_plantas')),
        sa.ForeignKeyConstraint(['producto_id'], ['productos.id'], name=op.f('fk_movimientos_inventario_producto_id_productos'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_movimientos_inventario'))
    )
    op.create_index('ix_movimientos_inventario_fecha', 'movimientos_inventario', ['fecha'], unique=False)
    op.create_index('ix_movimientos_inventario_producto_planta', 'movimientos_inventario', ['producto_id', 'planta_id'], unique=False)
    op.create_index('ix_movimientos_inventario_planta', 'movimientos_inventario', ['planta_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_movimientos_inventario_planta', table_name='movimientos_inventario')
    op.drop_index('ix_movimientos_inventario_producto_planta', table_name='movimientos_inventario')
    op.drop_index('ix_movimientos_inventario_fecha', table_name='movimientos_inventario')
    op.drop_table('movimientos_inventario')
    op.drop_table('productos')
