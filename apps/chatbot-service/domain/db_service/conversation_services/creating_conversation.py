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


class CreatingConversationInput(BaseModel):
    """Input model for CreatingConversationService"""
    title: Optional[str] = None  # Can be None, will be auto-generated from first message
    # Optional for anonymous chatbot embed sessions.
    user_id: Optional[uuid.UUID] = None
    chatbot_id: Optional[uuid.UUID] = None


class CreatingConversationOutput(BaseModel):
    """Output model for CreatingConversationService"""
    status: bool
    message: str = ''
    conversation_id: Optional[uuid.UUID] = None


class CreatingConversationService(BaseService):
    """Service to handle conversation creation operations"""

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

    def process(self, input: CreatingConversationInput, db=None) -> CreatingConversationOutput:
        """
        Create a new conversation in the database

        Args:
            input: CreatingConversationInput with conversation details
            db: Optional database session (if None, creates new session)

        Returns:
            CreatingConversationOutput with status
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
                    f'Error creating conversation for user {input.user_id}: {str(e)}',
                )
                return CreatingConversationOutput(
                    status=False,
                    message=f"Error creating conversation: {str(e)}",
                )

    def _process_with_session(self, input: CreatingConversationInput, session) -> CreatingConversationOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Create conversation. user_id may be None for anonymous embed sessions;
            # chatbot_id is set when the conversation is bound to a configured chatbot.
            conversation = Conversation(
                title=input.title,
                user_id=input.user_id,
                chatbot_id=input.chatbot_id,
                deleted=False,
            )

            saved_conversation = self.conversation_controller.insert(
                session, conversation,
            )

            logger.info(
                f'Successfully created conversation: {saved_conversation.id} for user: {input.user_id}',
            )

            return CreatingConversationOutput(
                status=True,
                message='Conversation created successfully',
                conversation_id=saved_conversation.id,
            )

        except Exception as e:
            logger.error(
                f'Error creating conversation for user {input.user_id}: {str(e)}',
            )
            return CreatingConversationOutput(
                status=False,
                message=f"Error creating conversation: {str(e)}",
            )
