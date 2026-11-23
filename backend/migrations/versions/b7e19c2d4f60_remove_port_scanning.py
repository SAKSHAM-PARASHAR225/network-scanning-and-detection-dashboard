"""remove port scanning tables and alert extensions

Revision ID: b7e19c2d4f60
Revises: a4c0daf392cc
Create Date: 2026-11-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7e19c2d4f60'
down_revision = 'a4c0daf392cc'
branch_labels = None
depends_on = None


def upgrade():
    # Port-scan alerts have no network_id, so they must go before network_id
    # can become NOT NULL again.
    op.execute("DELETE FROM alerts WHERE source = 'PORT_SCAN' OR network_id IS NULL")

    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.drop_index('ix_alerts_target_type_status')
        batch_op.drop_index(batch_op.f('ix_alerts_source'))
        batch_op.alter_column('network_id',
               existing_type=sa.INTEGER(),
               nullable=False)
        batch_op.drop_column('target_port')
        batch_op.drop_column('target_host')
        batch_op.drop_column('source')

    op.drop_table('port_scan_results')
    op.drop_table('port_scans')


def downgrade():
    op.create_table('port_scans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('target', sa.String(length=64), nullable=False),
    sa.Column('target_label', sa.String(length=255), nullable=True),
    sa.Column('target_mac', sa.String(length=17), nullable=True),
    sa.Column('scan_profile', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('ports_scanned', sa.Integer(), nullable=False),
    sa.Column('open_count', sa.Integer(), nullable=False),
    sa.Column('closed_count', sa.Integer(), nullable=False),
    sa.Column('filtered_count', sa.Integer(), nullable=False),
    sa.Column('risk_level', sa.String(length=16), nullable=True),
    sa.Column('risk_score', sa.Integer(), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('port_scans', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_port_scans_started_at'), ['started_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_port_scans_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_port_scans_target'), ['target'], unique=False)

    op.create_table('port_scan_results',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('scan_id', sa.Integer(), nullable=False),
    sa.Column('port', sa.Integer(), nullable=False),
    sa.Column('protocol', sa.String(length=8), nullable=False),
    sa.Column('state', sa.String(length=16), nullable=False),
    sa.Column('service', sa.String(length=64), nullable=True),
    sa.Column('product', sa.String(length=128), nullable=True),
    sa.Column('risk', sa.String(length=16), nullable=True),
    sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['scan_id'], ['port_scans.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('port_scan_results', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_port_scan_results_scan_id'), ['scan_id'], unique=False)

    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(length=16), nullable=False, server_default='WIFI_SCAN'))
        batch_op.add_column(sa.Column('target_host', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('target_port', sa.Integer(), nullable=True))
        batch_op.alter_column('network_id',
               existing_type=sa.INTEGER(),
               nullable=True)
        batch_op.create_index(batch_op.f('ix_alerts_source'), ['source'], unique=False)
        batch_op.create_index('ix_alerts_target_type_status', ['target_host', 'target_port', 'type', 'status'], unique=False)

    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.alter_column('source', server_default=None)
