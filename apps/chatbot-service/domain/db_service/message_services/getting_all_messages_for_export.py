"""Service for getting all messages for export functionality."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.settings.settings import PostgresSettings
from sqlalchemy import select

logger = get_logger(__name__)


class ExportMessageItem(BaseModel):
    """Single message item for export."""

    timestamp: datetime
    conversation_title: Optional[str]
    message_type: str
    contents: str


class GettingAllMessagesForExportInput(BaseModel):
    """Input model for getting all messages for export."""

    user_id: uuid.UUID
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GettingAllMessagesForExportOutput(BaseModel):
    """Output model for getting all messages for export."""

    status: bool
    message: str = ''
    data: List[ExportMessageItem] = []


class GettingAllMessagesForExportService(BaseService):
    """Service to retrieve all messages for a user for export."""

    settings: PostgresSettings

    @cached_property
    def postgres_db(self) -> SQLDatabase:
        """Get shared postgres_db instance (cached per service)."""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    def process(
        self,
        input: GettingAllMessagesForExportInput,
        db=None,
    ) -> GettingAllMessagesForExportOutput:
        """Get all messages for export with optional date filtering.

        Args:
            input: Input with user_id and optional date filters.
            db: Optional database session.

        Returns:
            Output with list of messages for export.
        """
        if db is not None:
            return self._process_with_session(input, db)

        try:
            with self.postgres_db.sessionmaker() as session:
                return self._process_with_session(input, session)
        except Exception as e:
            logger.error(f"Error getting messages for export: {e}")
            return GettingAllMessagesForExportOutput(
                status=False,
                message=f"Failed to retrieve messages: {e}",
            )

    def _process_with_session(
        self,
        input: GettingAllMessagesForExportInput,
        db,
    ) -> GettingAllMessagesForExportOutput:
        """Internal method with provided session."""
        try:
            from joint.postgres.models import Conversation as ConversationModel
            from joint.postgres.models import Message as MessageModel

            # Build query with join to get conversation title
            stmt = (
                select(
                    MessageModel.created_at,
                    ConversationModel.title,
                    MessageModel.type,
                    MessageModel.contents,
                )
                .join(ConversationModel, MessageModel.conversation_id == ConversationModel.id)
                .where(MessageModel.user_id == input.user_id)
                .where(ConversationModel.deleted == False)  # noqa: E712
            )

            # Apply date filters
            if input.start_date:
                stmt = stmt.where(MessageModel.created_at >= input.start_date)
            if input.end_date:
                stmt = stmt.where(MessageModel.created_at <= input.end_date)

            # Order by timestamp
            stmt = stmt.order_by(MessageModel.created_at.asc())

            results = db.execute(stmt).all()

            # Convert to export items
            export_items = [
                ExportMessageItem(
                    timestamp=row.created_at,
                    conversation_title=row.title,
                    message_type=row.type,
                    contents=row.contents,
                )
                for row in results
            ]

            logger.info(f"Retrieved {len(export_items)} messages for export")
            return GettingAllMessagesForExportOutput(
                status=True,
                message=f"Successfully retrieved {len(export_items)} messages",
                data=export_items,
            )

        except Exception as e:
            logger.error(
                f"Error getting messages for export: {e}", exc_info=True,
            )
            return GettingAllMessagesForExportOutput(
                status=False,
                message=f"Failed to retrieve messages: {e}",
            )
