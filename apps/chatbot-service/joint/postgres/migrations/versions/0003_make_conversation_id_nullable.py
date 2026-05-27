"""Make conversation_id nullable in file attachments table

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-26 14:30:00.000000

"""
from __future__ import annotations

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make conversation_id nullable in conversation_file_attachments table.
    
    This allows files to be uploaded first without being attached to a conversation,
    then later linked when used in a chat message (2-step upload flow).
    """
    # Drop the foreign key constraint first
    op.drop_constraint(
        'conversation_file_attachments_conversation_id_fkey', 
        'conversation_file_attachments', 
        type_='foreignkey'
    )
    
    # ALTER the column to be nullable
    op.alter_column(
        'conversation_file_attachments',
        'conversation_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )
    
    # Re-add the foreign key constraint (now allows NULL)
    op.create_foreign_key(
        'conversation_file_attachments_conversation_id_fkey',
        'conversation_file_attachments', 
        'conversations',
        ['conversation_id'], 
        ['id'], 
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Revert conversation_id back to non-nullable.
    
    WARNING: This will fail if there are any records with NULL conversation_id.
    You should update or delete such records before running this downgrade.
    """
    # Drop the foreign key constraint
    op.drop_constraint(
        'conversation_file_attachments_conversation_id_fkey', 
        'conversation_file_attachments', 
        type_='foreignkey'
    )
    
    # ALTER the column back to non-nullable
    op.alter_column(
        'conversation_file_attachments',
        'conversation_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
    
    # Re-add the foreign key constraint (requires NOT NULL)
    op.create_foreign_key(
        'conversation_file_attachments_conversation_id_fkey',
        'conversation_file_attachments', 
        'conversations',
        ['conversation_id'], 
        ['id'], 
        ondelete='CASCADE'
    )