from __future__ import annotations

import uuid
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.postgres.database.schemas import Conversation
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class UpdatingConversationInput(BaseModel):
    """Input model for UpdatingConversationService"""
    conversation_id: uuid.UUID
    title: Optional[str] = None
    deleted: Optional[bool] = None


class UpdatingConversationOutput(BaseModel):
    """Output model for UpdatingConversationService"""
    status: bool
    message: str = ''
    conversation: Optional[Conversation] = None


class UpdatingConversationService(BaseService):
    """Service to handle conversation update operations"""

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
    def conversation_controller(self) -> ConversationController:
        """Get conversation controller instance"""
        return ConversationController()

    def process(self, input: UpdatingConversationInput, db=None) -> UpdatingConversationOutput:
        """
        Update an existing conversation

        Args:
            input: UpdatingConversationInput with conversation details
            db: Optional database session (if None, creates new session)

        Returns:
            UpdatingConversationOutput with status
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
                logger.error(
                    f'Error updating conversation {input.conversation_id}: {str(e)}',
                )
                return UpdatingConversationOutput(
                    status=False,
                    message=f"Error updating conversation: {str(e)}",
                )

    def _process_with_session(self, input: UpdatingConversationInput, session) -> UpdatingConversationOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Get existing conversation
            existing_conversation = self.conversation_controller.get_by_id(
                session, input.conversation_id,
            )

            if not existing_conversation:
                logger.error(
                    f'Conversation not found: {input.conversation_id}',
                )
                return UpdatingConversationOutput(
                    status=False,
                    message=f"Conversation not found: {input.conversation_id}",
                )

            # Update fields if provided
            if input.title is not None:
                existing_conversation.title = input.title
            if input.deleted is not None:
                existing_conversation.deleted = input.deleted

            # Update in database
            updated_conversation = self.conversation_controller.update(
                session, existing_conversation,
            )

            if not updated_conversation:
                logger.error(
                    f'Failed to update conversation: {input.conversation_id}',
                )
                return UpdatingConversationOutput(
                    status=False,
                    message='Failed to update conversation',
                )

            logger.info(
                f'Successfully updated conversation: {input.conversation_id}',
            )

            return UpdatingConversationOutput(
                status=True,
                message='Conversation updated successfully',
                conversation=updated_conversation,
            )

        except Exception as e:
            logger.error(
                f'Error updating conversation {input.conversation_id}: {str(e)}',
            )
            return UpdatingConversationOutput(
                status=False,
                message=f"Error updating conversation: {str(e)}",
            )
