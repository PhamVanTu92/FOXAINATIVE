"""Drop static_contexts table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop static_contexts table and its indexes."""
    # Drop indexes first
    op.drop_index('ix_static_contexts_user_id', table_name='static_contexts', if_exists=True)
    op.drop_index('ix_static_contexts_context_type', table_name='static_contexts', if_exists=True)
    op.drop_index('ix_static_contexts_id', table_name='static_contexts', if_exists=True)
    
    # Then drop the table
    op.execute('DROP TABLE IF EXISTS static_contexts')


def downgrade() -> None:
    """Recreate static_contexts table (in case rollback is needed)."""
    op.create_table(
        'static_contexts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('context_type', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('file_url', sa.String(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
    )
    
    # Recreate indexes
    op.create_index('ix_static_contexts_id', 'static_contexts', ['id'], unique=False)
    op.create_index('ix_static_contexts_user_id', 'static_contexts', ['user_id'], unique=False)
    op.create_index('ix_static_contexts_context_type', 'static_contexts', ['context_type'], unique=True)