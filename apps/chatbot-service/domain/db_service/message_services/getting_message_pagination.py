from __future__ import annotations

import uuid
from typing import List
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import MessageController
from joint.postgres.database.schemas import ConversationFileAttachment
from joint.postgres.database.schemas import Message
from joint.settings.settings import PostgresSettings
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import joinedload


logger = get_logger(__name__)


class FileAttachmentInfo(BaseModel):
    """Compact file attachment info for message display."""
    file_id: uuid.UUID
    file_name: str
    file_type: str
    file_size: int
    storage_url: str


class MessageWithAttachment(BaseModel):
    """Message with optional file attachments."""
    message: Message
    file_attachments: List[FileAttachmentInfo] = []


class PaginatedMessageData(BaseModel):
    """Paginated message data model"""
    messages: List[MessageWithAttachment]
    total: int
    page: int
    page_size: int
    total_pages: int


class GettingMessagePaginationInput(BaseModel):
    """
    Input model for getting messages service with pagination.
    Contains conversation_id, pagination parameters, and search query.
    """
    conversation_id: uuid.UUID
    page: int = 1
    page_size: int = 10
    search_query: Optional[str] = None


class GettingMessagePaginationOutput(BaseModel):
    """
    Output model for getting messages service with pagination.
    Contains status, message, and paginated message data.
    """
    status: bool
    message: str = ''
    data: Optional[PaginatedMessageData] = None


class GettingMessagePaginationService(BaseService):
    """Service to handle message retrieval operations with pagination"""

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

    @property
    def message_controller(self) -> MessageController:
        """Get message controller instance"""
        return MessageController()

    def process(
        self,
        input: GettingMessagePaginationInput,
        db=None,
    ) -> GettingMessagePaginationOutput:
        """
        Get paginated messages with filtering

        Args:
            input: GettingMessagePaginationInput with pagination and filter options
            db: Optional database session (if None, creates new session)

        Returns:
            GettingMessagePaginationOutput with paginated message data
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(f"Error getting messages: {str(e)}")
                return GettingMessagePaginationOutput(
                    status=False,
                    message=f"Failed to retrieve messages: {str(e)}",
                )

    def _process_with_session(self, input: GettingMessagePaginationInput, db) -> GettingMessagePaginationOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Validate pagination parameters
            if input.page < 1:
                return GettingMessagePaginationOutput(
                    status=False,
                    message='Page number must be >= 1',
                )

            if input.page_size < 1 or input.page_size > 1000:
                return GettingMessagePaginationOutput(
                    status=False,
                    message='Page size must be between 1 and 1000',
                )

            # Build filter conditions
            filter_conditions = {'conversation_id': input.conversation_id}

            # Get total count for pagination
            total_messages = self._get_total_count(
                db, filter_conditions, input.search_query,
            )

            # Calculate pagination info
            total_pages = (
                total_messages + input.page_size -
                1
            ) // input.page_size if total_messages > 0 else 0

            # Handle case when no messages exist
            if total_messages == 0:
                logger.info(
                    f"No messages found for conversation: {input.conversation_id}",
                )
                return GettingMessagePaginationOutput(
                    status=True,
                    data=PaginatedMessageData(
                        messages=[],
                        total=0,
                        page=input.page,
                        page_size=input.page_size,
                        total_pages=0,
                    ),
                    message='No messages found',
                )

            # Handle case when requested page is beyond available pages
            if input.page > total_pages:
                logger.warning(
                    f"Requested page {input.page} exceeds total pages {total_pages}",
                )
                return GettingMessagePaginationOutput(
                    status=False,
                    message=f"Page {input.page} not found. Total pages available: {total_pages}",
                )

            # Calculate offset for SQL query
            # Page 1: offset = 0, Page 2: offset = page_size, etc.
            offset = (input.page - 1) * input.page_size

            # Get paginated messages
            messages = self._get_paginated_messages(
                db, filter_conditions, offset, input.page_size, input.search_query,
            )

            # This should not happen if our logic is correct, but just in case
            if not messages:
                return GettingMessagePaginationOutput(
                    status=False,
                    message=f"No messages found for page {input.page}",
                )

            logger.info(
                f"Retrieved {len(messages)} messages "
                f"(page {input.page}/{total_pages}, total: {total_messages}) "
                f"for conversation: {input.conversation_id}",
            )

            return GettingMessagePaginationOutput(
                status=True,
                data=PaginatedMessageData(
                    messages=messages,
                    total=total_messages,
                    page=input.page,
                    page_size=input.page_size,
                    total_pages=total_pages,
                ),
                message=f"Successfully retrieved {len(messages)} messages",
            )

        except Exception as e:
            logger.error(f"Error getting messages: {str(e)}")
            return GettingMessagePaginationOutput(
                status=False,
                message=f"Failed to retrieve messages: {str(e)}",
            )

    def _get_total_count(self, session, filter_conditions: dict, search_query: Optional[str] = None) -> int:
        """Get total count of messages matching filter conditions"""
        try:
            from joint.postgres.models import Message as MessageModel

            stmt = select(func.count(MessageModel.id))
            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if search_query is provided
            if search_query:
                stmt = stmt.where(
                    MessageModel.content.ilike(f"%{search_query}%"),
                )

            result = session.execute(stmt).scalar()
            return result or 0
        except Exception as e:
            logger.error(f"Error getting total count: {str(e)}")
            return 0

    def _get_paginated_messages(
        self, session, filter_conditions: dict, offset: int, limit: int, search_query: Optional[str] = None,
    ) -> List[MessageWithAttachment]:
        """Get paginated messages with file attachments via LEFT JOIN."""
        try:
            from joint.postgres.models import Message as MessageModel

            # Use joinedload to eagerly fetch file_attachments in a single query
            stmt = select(MessageModel).options(
                joinedload(MessageModel.file_attachments),
            )

            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if search_query is provided
            if search_query:
                stmt = stmt.where(
                    MessageModel.contents.ilike(f"%{search_query}%"),
                )

            # Order by created_at ASC to get messages in chronological order (oldest first)
            stmt = stmt.order_by(MessageModel.created_at.asc())
            stmt = stmt.offset(offset).limit(limit)

            results = session.execute(stmt).scalars().unique().all()

            # Convert to schemas with file attachments
            messages_with_attachments = []

            for message_model in results:
                message_schema = Message.model_validate(message_model)

                # Convert file attachment ORM objects to compact info
                file_attachments = [
                    FileAttachmentInfo(
                        file_id=att.id,
                        file_name=att.file_name,
                        file_type=att.file_type,
                        file_size=att.file_size,
                        storage_url=att.storage_path,
                    )
                    for att in (message_model.file_attachments or [])
                ]

                messages_with_attachments.append(
                    MessageWithAttachment(
                        message=message_schema,
                        file_attachments=file_attachments,
                    ),
                )

            logger.info(
                f"Retrieved {len(messages_with_attachments)} messages",
                extra={
                    'total_messages': len(messages_with_attachments),
                },
            )

            return messages_with_attachments

        except Exception as e:
            logger.error(
                f"Error getting paginated messages: {str(e)}", exc_info=True,
            )
            return []
