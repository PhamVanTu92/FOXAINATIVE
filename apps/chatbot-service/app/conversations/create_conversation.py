from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.conversation_services import CreatingConversationInput
from domain.db_service.conversation_services import CreatingConversationOutput as DomainCreatingConversationOutput
from domain.db_service.conversation_services import CreatingConversationService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class ConversationCreatingInput(BaseModel):
    """Input model for creating conversation"""
    user_id: uuid.UUID
    title: Optional[str] = None


class ConversationCreatingOutput(BaseModel):
    """Output model for creating conversation"""
    conversation_id: Optional[uuid.UUID] = None
    message: str = ''


class ConversationCreatingService(BaseService):
    """App service for creating conversations"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: ConversationCreatingInput, db_session=None) -> ConversationCreatingOutput:
        """
        Process conversation creation request

        Args:
            inputs: ConversationCreatingInput with conversation details
            db_session: Optional database session

        Returns:
            ConversationCreatingOutput with conversation_id
        """
        try:
            logger.info('Creating new conversation')

            # Create domain service input
            domain_input = CreatingConversationInput(
                user_id=inputs.user_id,
                title=inputs.title,
            )

            # Initialize and run domain service
            domain_service = CreatingConversationService(
                settings=self.postgres_settings,
            )
            result: DomainCreatingConversationOutput = domain_service.process(
                domain_input, db_session,
            )

            if result.status:
                logger.info(
                    f"Successfully created conversation: {result.conversation_id}",
                )
                return ConversationCreatingOutput(
                    conversation_id=result.conversation_id,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to create conversation: {result.message}",
                )
                return ConversationCreatingOutput(
                    conversation_id=None,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error creating conversation: {str(e)}"
            logger.error(error_msg)
            return ConversationCreatingOutput(
                conversation_id=None,
                message=error_msg,
            )
