"""Add chatbots + chatbot_collections, make conversation user_id nullable, add chatbot_id.

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-25
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── chatbots ─────────────────────────────────────────────────────
    op.create_table(
        'chatbots',
        sa.Column(
            'id', postgresql.UUID(as_uuid=True),
            primary_key=True, nullable=False,
        ),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column(
            'purpose', sa.String(64),
            nullable=False, server_default='customer_care',
        ),
        sa.Column(
            'form', sa.String(16),
            nullable=False, server_default='chat',
        ),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('system_prompt', sa.String(), nullable=True),
        sa.Column('faqs', postgresql.JSONB(), nullable=True),
        sa.Column('llm_provider', sa.String(32), nullable=True),
        sa.Column('embedding_provider', sa.String(32), nullable=True),
        sa.Column('welcome_message', sa.String(), nullable=True),
        sa.Column('widget_theme', postgresql.JSONB(), nullable=True),
        sa.Column(
            'public_id', postgresql.UUID(as_uuid=True),
            nullable=False, unique=True,
        ),
        sa.Column(
            'is_active', sa.Boolean(),
            nullable=False, server_default=sa.text('true'),
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_chatbots_id', 'chatbots', ['id'])
    op.create_index('ix_chatbots_user_id', 'chatbots', ['user_id'])
    op.create_index('ix_chatbots_public_id', 'chatbots', ['public_id'])

    # ── chatbot_collections ──────────────────────────────────────────
    op.create_table(
        'chatbot_collections',
        sa.Column(
            'chatbot_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('chatbots.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'collection_id', postgresql.UUID(as_uuid=True), nullable=False,
        ),
        sa.Column('collection_name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint(
            'chatbot_id', 'collection_id', name='pk_chatbot_collections',
        ),
    )
    op.create_index(
        'ix_chatbot_collections_chatbot_id',
        'chatbot_collections', ['chatbot_id'],
    )

    # ── conversations: nullable user_id + add chatbot_id ────────────
    op.alter_column(
        'conversations', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        'conversations',
        sa.Column(
            'chatbot_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('chatbots.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_conversations_chatbot_id',
        'conversations', ['chatbot_id'],
    )

    # ── messages: nullable user_id (mirror conversations) ──────────
    op.alter_column(
        'messages', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'messages', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_index('ix_conversations_chatbot_id', table_name='conversations')
    op.drop_column('conversations', 'chatbot_id')
    op.alter_column(
        'conversations', 'user_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_index(
        'ix_chatbot_collections_chatbot_id', table_name='chatbot_collections',
    )
    op.drop_table('chatbot_collections')
    op.drop_index('ix_chatbots_public_id', table_name='chatbots')
    op.drop_index('ix_chatbots_user_id', table_name='chatbots')
    op.drop_index('ix_chatbots_id', table_name='chatbots')
    op.drop_table('chatbots')
