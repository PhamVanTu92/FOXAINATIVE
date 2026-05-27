from __future__ import annotations

import uuid

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class DeletingConversationInput(BaseModel):
    """Input model for DeletingConversationService"""
    conversation_id: uuid.UUID
    hard_delete: bool = False  # True for hard delete, False for soft delete


class DeletingConversationOutput(BaseModel):
    """Output model for DeletingConversationService"""
    status: bool
    message: str = ''


class DeletingConversationService(BaseService):
    """Service to handle conversation deletion operations (soft or hard delete)"""

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

    def process(self, input: DeletingConversationInput, db=None) -> DeletingConversationOutput:
        """
        Delete a conversation (soft or hard delete)

        Args:
            input: DeletingConversationInput with conversation_id
            db: Optional database session (if None, creates new session)

        Returns:
            DeletingConversationOutput with status
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
                    f'Error deleting conversation {input.conversation_id}: {str(e)}',
                )
                return DeletingConversationOutput(
                    status=False,
                    message=f"Error deleting conversation: {str(e)}",
                )

    def _process_with_session(self, input: DeletingConversationInput, session) -> DeletingConversationOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            if input.hard_delete:
                # Hard delete from database
                deleted_conversation = self.conversation_controller.delete(
                    session, input.conversation_id,
                )

                if not deleted_conversation:
                    logger.error(
                        f'Conversation not found: {input.conversation_id}',
                    )
                    return DeletingConversationOutput(
                        status=False,
                        message=f"Conversation not found: {input.conversation_id}",
                    )

                logger.info(
                    f'Successfully hard deleted conversation: {input.conversation_id}',
                )
                return DeletingConversationOutput(
                    status=True,
                    message='Conversation permanently deleted',
                )
            else:
                # Soft delete (mark as deleted)
                existing_conversation = self.conversation_controller.get_by_id(
                    session, input.conversation_id,
                )

                if not existing_conversation:
                    logger.error(
                        f'Conversation not found: {input.conversation_id}',
                    )
                    return DeletingConversationOutput(
                        status=False,
                        message=f"Conversation not found: {input.conversation_id}",
                    )

                # Mark as deleted
                existing_conversation.deleted = True
                updated_conversation = self.conversation_controller.update(
                    session, existing_conversation,
                )

                if not updated_conversation:
                    logger.error(
                        f'Failed to soft delete conversation: {input.conversation_id}',
                    )
                    return DeletingConversationOutput(
                        status=False,
                        message='Failed to delete conversation',
                    )

                logger.info(
                    f'Successfully soft deleted conversation: {input.conversation_id}',
                )
                return DeletingConversationOutput(
                    status=True,
                    message='Conversation deleted successfully',
                )

        except Exception as e:
            logger.error(
                f'Error deleting conversation {input.conversation_id}: {str(e)}',
            )
            return DeletingConversationOutput(
                status=False,
                message=f"Error deleting conversation: {str(e)}",
            )
