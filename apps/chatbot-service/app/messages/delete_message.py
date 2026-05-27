from __future__ import annotations

import uuid

from domain.db_service.message_services import DeletingMessageInput
from domain.db_service.message_services import DeletingMessageService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class MessageDeletingInput(BaseModel):
    """Input model for deleting messages"""
    user_id: uuid.UUID


class MessageDeletingOutput(BaseModel):
    """Output model for deleting messages"""
    message: str = ''


class MessageDeletingService(BaseService):
    """App service for deleting messages"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: MessageDeletingInput, db_session=None) -> MessageDeletingOutput:
        """
        Process messages deletion request

        Args:
            inputs: MessageDeletingInput with user_id
            db_session: Optional database session

        Returns:
            MessageDeletingOutput with operation result
        """
        try:
            logger.info(
                f"Deleting all messages for user_id: {inputs.user_id}",
            )

            # Create domain service input
            domain_input = DeletingMessageInput(
                user_id=inputs.user_id,
            )

            # Initialize and run domain service
            domain_service = DeletingMessageService(
                settings=self.postgres_settings,
            )
            result = domain_service.process(domain_input, db_session)

            if result.status:
                logger.info(f"Successfully deleted messages: {result.message}")
                return MessageDeletingOutput(
                    message=result.message,
                )
            else:
                logger.warning(f"Failed to delete messages: {result.message}")
                return MessageDeletingOutput(
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error deleting messages: {str(e)}"
            logger.error(error_msg)
            return MessageDeletingOutput(
                message=error_msg,
            )
