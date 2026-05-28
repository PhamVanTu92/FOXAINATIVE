from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.message_services import GettingMessagePaginationInput
from domain.db_service.message_services import GettingMessagePaginationService
from domain.db_service.message_services import PaginatedMessageData
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class MessageGettingInput(BaseModel):
    """Input model for getting messages with pagination"""
    conversation_id: uuid.UUID
    page: int = 1
    page_size: int = 10
    search_query: Optional[str] = None


class MessageGettingOutput(BaseModel):
    """Output model for getting messages with pagination"""
    data: Optional[PaginatedMessageData] = None
    message: str = ''


class MessageGettingService(BaseService):
    """App service for getting messages with pagination"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: MessageGettingInput, db_session=None) -> MessageGettingOutput:
        """
        Process message getting request with pagination

        Args:
            inputs: MessageGettingInput with pagination parameters
            db_session: Optional database session

        Returns:
            MessageGettingOutput with paginated message data
        """
        try:
            logger.info(
                f"Getting messages - page: {inputs.page}, "
                f"page_size: {inputs.page_size}, conversation_id: {inputs.conversation_id}",
            )

            # Create domain service input
            domain_input = GettingMessagePaginationInput(
                conversation_id=inputs.conversation_id,
                page=inputs.page,
                page_size=inputs.page_size,
                search_query=inputs.search_query,
            )

            # Initialize and run domain service
            domain_service = GettingMessagePaginationService(
                settings=self.postgres_settings,
            )
            result = domain_service.process(domain_input, db_session)

            if result.status:
                logger.info(
                    f"Successfully retrieved messages: {result.message}",
                )
                return MessageGettingOutput(
                    data=result.data,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to retrieve messages: {result.message}",
                )
                return MessageGettingOutput(
                    data=None,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error getting messages: {str(e)}"
            logger.error(error_msg)
            return MessageGettingOutput(
                data=None,
                message=error_msg,
            )
