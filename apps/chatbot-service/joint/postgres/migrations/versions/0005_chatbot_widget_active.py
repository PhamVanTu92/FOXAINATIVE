"""Add chatbots.is_widget_active flag (one active widget per user).

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-25
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'chatbots',
        sa.Column(
            'is_widget_active', sa.Boolean(),
            nullable=False, server_default=sa.text('false'),
        ),
    )
    # Partial unique index: at most one row per user with is_widget_active=true.
    # The apply endpoint clears the previous active row before setting the new
    # one in the same transaction so the constraint always holds.
    op.create_index(
        'uq_chatbots_user_one_active', 'chatbots', ['user_id'],
        unique=True,
        postgresql_where=sa.text('is_widget_active = true'),
    )


def downgrade() -> None:
    op.drop_index('uq_chatbots_user_one_active', table_name='chatbots')
    op.drop_column('chatbots', 'is_widget_active')
