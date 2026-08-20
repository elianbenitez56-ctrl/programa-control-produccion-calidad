"""modulo_produccion_op_registros_paradas_calidad

Revision ID: a1b2c3d4e5f6
Revises: 9e2a2c4d5e6
Create Date: 2026-08-06 15:00:00.000000

Crea el dominio de Producción con la OP como entidad raíz: ordenes_produccion,
registros diarios (captura por turno), paradas e incidencias de calidad. Todas
las tablas referencian los catálogos reales (plantas, áreas, máquinas, turnos,
usuarios) — no existe duplicación de datos.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = '9e2a2c4d5e6'
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
    op.create_table('ordenes_produccion',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('numero_op', sa.String(length=30), nullable=False),
        sa.Column('cliente', sa.String(length=120), nullable=False),
        sa.Column('producto', sa.String(length=120), nullable=False),
        sa.Column('descripcion', sa.String(length=255), nullable=True),
        sa.Column('unidad', sa.String(length=10), server_default='t', nullable=False),
        sa.Column('cantidad_planificada', sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column('cantidad_producida', sa.Numeric(precision=14, scale=4), server_default='0', nullable=False),
        sa.Column('prioridad', sa.Integer(), server_default='5', nullable=False),
        sa.Column('estado', sa.String(length=20), server_default='borrador', nullable=False),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_programada', sa.Date(), nullable=True),
        sa.Column('planta_id', sa.String(length=36), nullable=False),
        sa.Column('area_id', sa.String(length=36), nullable=False),
        sa.Column('maquina_id', sa.String(length=36), nullable=False),
        sa.Column('operario_id', sa.String(length=36), nullable=True),
        sa.Column('turno_id', sa.String(length=36), nullable=True),
        sa.Column('fecha_inicio', sa.DateTime(timezone=True), nullable=True),
        sa.Column('fecha_fin', sa.DateTime(timezone=True), nullable=True),
        *_audit_cols(),
        sa.CheckConstraint('prioridad BETWEEN 1 AND 10', name=op.f('ck_ordenes_produccion_ck_ordenes_produccion_prioridad')),
        sa.CheckConstraint("estado IN ('borrador','asignada','en_produccion','pausada','finalizada','cancelada')", name=op.f('ck_ordenes_produccion_ck_ordenes_produccion_estado')),
        sa.CheckConstraint('cantidad_planificada IS NULL OR cantidad_planificada > 0', name=op.f('ck_ordenes_produccion_ck_ordenes_produccion_cantidad_planificada')),
        sa.CheckConstraint('fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio', name=op.f('ck_ordenes_produccion_ck_ordenes_produccion_fechas')),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], name=op.f('fk_ordenes_produccion_area_id_areas')),
        sa.ForeignKeyConstraint(['maquina_id'], ['maquinas.id'], name=op.f('fk_ordenes_produccion_maquina_id_maquinas')),
        sa.ForeignKeyConstraint(['operario_id'], ['usuarios.id'], name=op.f('fk_ordenes_produccion_operario_id_usuarios')),
        sa.ForeignKeyConstraint(['planta_id'], ['plantas.id'], name=op.f('fk_ordenes_produccion_planta_id_plantas')),
        sa.ForeignKeyConstraint(['turno_id'], ['turnos.id'], name=op.f('fk_ordenes_produccion_turno_id_turnos')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_ordenes_produccion')),
        sa.UniqueConstraint('numero_op', name=op.f('uq_ordenes_produccion_numero_op'))
    )
    op.create_index('ix_ordenes_produccion_estado', 'ordenes_produccion', ['estado'], unique=False)
    op.create_index('ix_ordenes_produccion_fecha_emision', 'ordenes_produccion', ['fecha_emision'], unique=False)
    op.create_index('ix_ordenes_produccion_maquina_estado', 'ordenes_produccion', ['maquina_id', 'estado'], unique=False)

    op.create_table('registros_diarios',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('op_id', sa.String(length=36), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('turno_id', sa.String(length=36), nullable=False),
        sa.Column('operario_id', sa.String(length=36), nullable=False),
        sa.Column('planta_id', sa.String(length=36), nullable=False),
        sa.Column('area_id', sa.String(length=36), nullable=False),
        sa.Column('maquina_id', sa.String(length=36), nullable=False),
        sa.Column('hora_inicio', sa.Time(), nullable=True),
        sa.Column('hora_fin', sa.Time(), nullable=True),
        sa.Column('produccion_total', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('produccion_buena', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('produccion_rechazada', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('unidad', sa.String(length=10), server_default='t', nullable=False),
        sa.Column('tiempo_operativo_min', sa.Integer(), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        *_audit_cols(),
        sa.CheckConstraint('produccion_buena >= 0', name=op.f('ck_registros_diarios_ck_registros_diarios_buena')),
        sa.CheckConstraint('produccion_rechazada >= 0', name=op.f('ck_registros_diarios_ck_registros_diarios_rechazada')),
        sa.CheckConstraint('produccion_total >= 0 AND produccion_buena + produccion_rechazada <= produccion_total', name=op.f('ck_registros_diarios_ck_registros_diarios_coherencia')),
        sa.CheckConstraint('hora_fin IS NULL OR hora_inicio IS NULL OR hora_fin > hora_inicio', name=op.f('ck_registros_diarios_ck_registros_diarios_horas')),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], name=op.f('fk_registros_diarios_area_id_areas')),
        sa.ForeignKeyConstraint(['maquina_id'], ['maquinas.id'], name=op.f('fk_registros_diarios_maquina_id_maquinas')),
        sa.ForeignKeyConstraint(['op_id'], ['ordenes_produccion.id'], name=op.f('fk_registros_diarios_op_id_ordenes_produccion'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['operario_id'], ['usuarios.id'], name=op.f('fk_registros_diarios_operario_id_usuarios')),
        sa.ForeignKeyConstraint(['planta_id'], ['plantas.id'], name=op.f('fk_registros_diarios_planta_id_plantas')),
        sa.ForeignKeyConstraint(['turno_id'], ['turnos.id'], name=op.f('fk_registros_diarios_turno_id_turnos')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_registros_diarios')),
        sa.UniqueConstraint('op_id', 'fecha', 'turno_id', name='uq_registros_diarios_op_fecha_turno')
    )
    op.create_index('ix_registros_diarios_fecha', 'registros_diarios', ['fecha'], unique=False)
    op.create_index('ix_registros_diarios_maquina_fecha', 'registros_diarios', ['maquina_id', 'fecha'], unique=False)
    op.create_index('ix_registros_diarios_op', 'registros_diarios', ['op_id'], unique=False)
    op.create_index('ix_registros_diarios_turno', 'registros_diarios', ['turno_id'], unique=False)

    op.create_table('paradas',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('op_id', sa.String(length=36), nullable=True),
        sa.Column('registro_id', sa.String(length=36), nullable=True),
        sa.Column('maquina_id', sa.String(length=36), nullable=False),
        sa.Column('turno_id', sa.String(length=36), nullable=True),
        sa.Column('motivo', sa.String(length=120), nullable=False),
        sa.Column('tipo', sa.String(length=20), server_default='no_planeada', nullable=False),
        sa.Column('inicio', sa.DateTime(timezone=True), nullable=False),
        sa.Column('fin', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duracion_min', sa.Integer(), nullable=True),
        sa.Column('observacion', sa.Text(), nullable=True),
        *_audit_cols(),
        sa.CheckConstraint("tipo IN ('planeada','no_planeada')", name=op.f('ck_paradas_ck_paradas_tipo')),
        sa.CheckConstraint('fin IS NULL OR fin > inicio', name=op.f('ck_paradas_ck_paradas_fin')),
        sa.CheckConstraint('duracion_min IS NULL OR duracion_min >= 0', name=op.f('ck_paradas_ck_paradas_duracion')),
        sa.ForeignKeyConstraint(['maquina_id'], ['maquinas.id'], name=op.f('fk_paradas_maquina_id_maquinas')),
        sa.ForeignKeyConstraint(['op_id'], ['ordenes_produccion.id'], name=op.f('fk_paradas_op_id_ordenes_produccion'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['registro_id'], ['registros_diarios.id'], name=op.f('fk_paradas_registro_id_registros_diarios'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['turno_id'], ['turnos.id'], name=op.f('fk_paradas_turno_id_turnos')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_paradas'))
    )
    op.create_index('ix_paradas_maquina_inicio', 'paradas', ['maquina_id', 'inicio'], unique=False)
    op.create_index('ix_paradas_op', 'paradas', ['op_id'], unique=False)
    op.create_index('ix_paradas_registro', 'paradas', ['registro_id'], unique=False)

    op.create_table('incidencias_calidad',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('op_id', sa.String(length=36), nullable=True),
        sa.Column('registro_id', sa.String(length=36), nullable=True),
        sa.Column('maquina_id', sa.String(length=36), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('codigo', sa.String(length=30), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('lote', sa.String(length=40), nullable=True),
        sa.Column('cantidad', sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column('estado', sa.String(length=20), server_default='abierta', nullable=False),
        sa.Column('fecha', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('turno_id', sa.String(length=36), nullable=True),
        *_audit_cols(),
        sa.CheckConstraint("tipo IN ('defecto','inspeccion','nc')", name=op.f('ck_incidencias_calidad_ck_incidencias_calidad_tipo')),
        sa.CheckConstraint("estado IN ('abierta','en_revision','cerrada')", name=op.f('ck_incidencias_calidad_ck_incidencias_calidad_estado')),
        sa.ForeignKeyConstraint(['maquina_id'], ['maquinas.id'], name=op.f('fk_incidencias_calidad_maquina_id_maquinas')),
        sa.ForeignKeyConstraint(['op_id'], ['ordenes_produccion.id'], name=op.f('fk_incidencias_calidad_op_id_ordenes_produccion'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['registro_id'], ['registros_diarios.id'], name=op.f('fk_incidencias_calidad_registro_id_registros_diarios'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['turno_id'], ['turnos.id'], name=op.f('fk_incidencias_calidad_turno_id_turnos')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_incidencias_calidad'))
    )
    op.create_index('ix_incidencias_calidad_maquina_fecha', 'incidencias_calidad', ['maquina_id', 'fecha'], unique=False)
    op.create_index('ix_incidencias_calidad_op', 'incidencias_calidad', ['op_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_incidencias_calidad_op', table_name='incidencias_calidad')
    op.drop_index('ix_incidencias_calidad_maquina_fecha', table_name='incidencias_calidad')
    op.drop_table('incidencias_calidad')
    op.drop_index('ix_paradas_registro', table_name='paradas')
    op.drop_index('ix_paradas_op', table_name='paradas')
    op.drop_index('ix_paradas_maquina_inicio', table_name='paradas')
    op.drop_table('paradas')
    op.drop_index('ix_registros_diarios_turno', table_name='registros_diarios')
    op.drop_index('ix_registros_diarios_op', table_name='registros_diarios')
    op.drop_index('ix_registros_diarios_maquina_fecha', table_name='registros_diarios')
    op.drop_index('ix_registros_diarios_fecha', table_name='registros_diarios')
    op.drop_table('registros_diarios')
    op.drop_index('ix_ordenes_produccion_maquina_estado', table_name='ordenes_produccion')
    op.drop_index('ix_ordenes_produccion_fecha_emision', table_name='ordenes_produccion')
    op.drop_index('ix_ordenes_produccion_estado', table_name='ordenes_produccion')
    op.drop_table('ordenes_produccion')