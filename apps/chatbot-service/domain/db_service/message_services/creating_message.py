from __future__ import annotations

import uuid
from typing import Any
from typing import Dict
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.postgres.database import MessageController
from joint.postgres.database.schemas import Message
from joint.postgres.database.schemas import MessageType
from joint.postgres.models import Conversation as ConversationModel
from joint.postgres.models import get_vietnam_now
from joint.settings.settings import PostgresSettings
from sqlalchemy import update


logger = get_logger(__name__)


class CreatingMessageInput(BaseModel):
    """
    Input model for creating message service.
    Contains user_message, assistant_message, user_id, conversation_id, and optional artifacts.
    """
    user_message: str
    assistant_message: str
    user_id: uuid.UUID
    conversation_id: uuid.UUID
    # Artifact data from tool executions
    artifacts: Optional[Dict[str, Any]] = None


class CreatingMessageOutput(BaseModel):
    """
    Output model for creating message service.
    Contains status, message and message IDs.
    """
    status: bool
    message: str = ''
    user_message_id: Optional[uuid.UUID] = None
    assistant_message_id: Optional[uuid.UUID] = None


class CreatingMessageService(BaseService):

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

    @property
    def conversation_controller(self) -> ConversationController:
        """Get conversation controller instance"""
        return ConversationController()

    def _save_message(self, content: str, message_type: MessageType, user_id: uuid.UUID, conversation_id: uuid.UUID, session=None, artifacts: Optional[Dict[str, Any]] = None) -> Optional[uuid.UUID]:
        """
        Save message to the database

        Args:
            content: Content of the message
            message_type: Type of message (MessageType.HUMAN or MessageType.AI)
            user_id: ID of the user
            conversation_id: ID of the conversation
            session: Optional database session (if None, creates new session)
            artifacts: Optional artifact data from tool executions

        Returns:
            UUID: Message ID if saved successfully, None if there was an error
        """
        if session is not None:
            # Use provided session (from dependency injection)
            return self._save_message_with_session(content, message_type, user_id, conversation_id, session, artifacts)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._save_message_with_session(content, message_type, user_id, conversation_id, session, artifacts)
            except Exception as e:
                logger.error(
                    f'Error saving {message_type.value} message: {str(e)}',
                )
                return None

    def _save_message_with_session(
        self,
        content: str,
        message_type: MessageType,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        session,
        artifacts: Optional[Dict[str, Any]] = None,
    ) -> Optional[uuid.UUID]:
        """Internal method that does the actual work with a provided session"""
        try:
            message = Message(
                type=message_type,
                contents=content,
                user_id=user_id,
                conversation_id=conversation_id,
                artifacts=artifacts,  # Add artifacts to message
            )

            saved_message = self.message_controller.insert(
                session, message,
            )
            logger.info(
                f'Saved {message_type.value} message: {saved_message.id} for conversation: {conversation_id} (with artifacts: {artifacts is not None})',
            )
            return saved_message.id

        except Exception as e:
            logger.error(
                f'Error saving {message_type.value} message in session: {str(e)}',
            )
            return None

    def _update_conversation_timestamp(self, conversation_id: uuid.UUID, session) -> bool:
        """
        Update conversation's updated_at timestamp

        Args:
            conversation_id: ID of the conversation to update
            session: Database session

        Returns:
            bool: True if updated successfully, False otherwise
        """
        try:
            # Force update conversation's updated_at timestamp
            stmt = update(ConversationModel).where(
                ConversationModel.id == conversation_id,
            ).values(updated_at=get_vietnam_now())

            result = session.execute(stmt)
            session.commit()

            if result.rowcount > 0:
                logger.info(
                    f'Updated timestamp for conversation: {conversation_id}',
                )
                return True
            else:
                logger.error(
                    f'Conversation {conversation_id} not found for timestamp update',
                )
                return False

        except Exception as e:
            logger.error(
                f'Error updating conversation timestamp for {conversation_id}: {str(e)}',
            )
            return False

    def save_user_message(self, content: str, user_id: uuid.UUID, conversation_id: uuid.UUID, session=None) -> Optional[uuid.UUID]:
        """Save user message to the database"""
        return self._save_message(content, MessageType.HUMAN, user_id, conversation_id, session)

    def save_assistant_message(self, content: str, user_id: uuid.UUID, conversation_id: uuid.UUID, artifacts: Optional[Dict[str, Any]] = None, session=None) -> Optional[uuid.UUID]:
        """Save assistant message to the database"""
        return self._save_message(content, MessageType.AI, user_id, conversation_id, session, artifacts)

    def process(self, input: CreatingMessageInput, session=None) -> CreatingMessageOutput:
        """
        Save both user message and assistant response to the database

        Args:
            input: CreatingMessageInput containing user_message, assistant_message, and user_id
            session: Optional database session (if None, creates new session)

        Returns:
            CreatingMessageOutput: Status and message IDs if successful
        """
        if session is not None:
            # Use provided session (from dependency injection)
            return self._process_with_session(input, session)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(
                    f'Error saving messages for user {input.user_id}: {str(e)}',
                )
                return CreatingMessageOutput(
                    status=False,
                    message=f"Error saving messages: {str(e)}",
                )

    def _process_with_session(self, input: CreatingMessageInput, session) -> CreatingMessageOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Save user message (no artifacts for user messages)
            user_message_id = self.save_user_message(
                content=input.user_message,
                user_id=input.user_id,
                conversation_id=input.conversation_id,
                session=session,
            )

            if user_message_id is None:
                logger.error(
                    f'Failed to save user message for conversation: {input.conversation_id}',
                )
                return CreatingMessageOutput(
                    status=False,
                    message='Failed to save user message',
                )

            logger.info(
                f'Successfully saved user message: {user_message_id} for conversation: {input.conversation_id}',
            )

            # Save assistant response with artifacts
            assistant_message_id = self.save_assistant_message(
                content=input.assistant_message,
                user_id=input.user_id,
                conversation_id=input.conversation_id,
                session=session,
                artifacts=input.artifacts,  # Pass artifacts to assistant message
            )

            if assistant_message_id is None:
                logger.error(
                    f'Failed to save assistant message for conversation: {input.conversation_id}',
                )
                return CreatingMessageOutput(
                    status=False,
                    message='Failed to save assistant message',
                    user_message_id=user_message_id,
                )

            logger.info(
                f'Successfully saved assistant message: {assistant_message_id} for conversation: {input.conversation_id}',
            )

            # Cập nhật timestamp của conversation
            timestamp_updated = self._update_conversation_timestamp(
                input.conversation_id, session,
            )
            if not timestamp_updated:
                logger.warning(
                    f'Failed to update conversation timestamp for: {input.conversation_id}',
                )

            # Both messages saved successfully
            logger.info(
                f'Successfully saved both messages for conversation: {input.conversation_id}',
            )
            return CreatingMessageOutput(
                status=True,
                message='Both messages saved successfully',
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
            )

        except Exception as e:
            logger.error(
                f'Error saving messages for conversation {input.conversation_id}: {str(e)}',
            )
            return CreatingMessageOutput(
                status=False,
                message=f"Error saving messages: {str(e)}",
            )
