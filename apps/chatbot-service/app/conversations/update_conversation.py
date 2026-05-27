from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.conversation_services import UpdatingConversationInput
from domain.db_service.conversation_services import UpdatingConversationOutput as DomainUpdatingConversationOutput
from domain.db_service.conversation_services import UpdatingConversationService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class ConversationUpdatingInput(BaseModel):
    """Input model for updating conversation"""
    conversation_id: uuid.UUID
    title: Optional[str] = None
    deleted: Optional[bool] = None


class ConversationUpdatingOutput(BaseModel):
    """Output model for updating conversation"""
    success: bool
    message: str = ''


class ConversationUpdatingService(BaseService):
    """App service for updating conversations"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: ConversationUpdatingInput, db_session=None) -> ConversationUpdatingOutput:
        """
        Process conversation update request

        Args:
            inputs: ConversationUpdatingInput with update details
            db_session: Optional database session

        Returns:
            ConversationUpdatingOutput with status
        """
        try:
            logger.info(f"Updating conversation: {inputs.conversation_id}")

            # Create domain service input
            domain_input = UpdatingConversationInput(
                conversation_id=inputs.conversation_id,
                title=inputs.title,
                deleted=inputs.deleted,
            )

            # Initialize and run domain service
            domain_service = UpdatingConversationService(
                settings=self.postgres_settings,
            )
            result: DomainUpdatingConversationOutput = domain_service.process(
                domain_input, db_session,
            )

            if result.status:
                logger.info(
                    f"Successfully updated conversation: {inputs.conversation_id}",
                )
                return ConversationUpdatingOutput(
                    success=True,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to update conversation: {result.message}",
                )
                return ConversationUpdatingOutput(
                    success=False,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error updating conversation: {str(e)}"
            logger.error(error_msg)
            return ConversationUpdatingOutput(
                success=False,
                message=error_msg,
            )
