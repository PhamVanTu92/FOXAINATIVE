from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.conversation_services import GettingConversationPaginationInput
from domain.db_service.conversation_services import GettingConversationPaginationService
from domain.db_service.conversation_services import PaginatedConversationData
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings


logger = get_logger(__name__)


class ConversationGettingInput(BaseModel):
    """Input model for getting conversations with pagination"""
    user_id: uuid.UUID
    page: int = 1
    page_size: int = 10
    include_deleted: bool = False
    search_query: Optional[str] = None


class ConversationGettingOutput(BaseModel):
    """Output model for getting conversations with pagination"""
    data: Optional[PaginatedConversationData] = None
    message: str = ''


class ConversationGettingService(BaseService):
    """App service for getting conversations with pagination"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: ConversationGettingInput, db_session=None) -> ConversationGettingOutput:
        """
        Process conversation getting request with pagination

        Args:
            inputs: ConversationGettingInput with pagination parameters
            db_session: Optional database session

        Returns:
            ConversationGettingOutput with paginated conversation data
        """
        try:
            logger.info(
                f"Getting conversations - page: {inputs.page}, "
                f"page_size: {inputs.page_size}, user_id: {inputs.user_id}",
            )

            # Create domain service input
            domain_input = GettingConversationPaginationInput(
                user_id=inputs.user_id,
                page=inputs.page,
                page_size=inputs.page_size,
                include_deleted=inputs.include_deleted,
                search_query=inputs.search_query,
            )

            # Initialize and run domain service
            domain_service = GettingConversationPaginationService(
                settings=self.postgres_settings,
            )
            result = domain_service.process(domain_input, db_session)

            if result.status:
                logger.info(
                    f"Successfully retrieved conversations: {result.message}",
                )
                return ConversationGettingOutput(
                    data=result.data,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to retrieve conversations: {result.message}",
                )
                return ConversationGettingOutput(
                    data=None,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error getting conversations: {str(e)}"
            logger.error(error_msg)
            return ConversationGettingOutput(
                data=None,
                message=error_msg,
            )
