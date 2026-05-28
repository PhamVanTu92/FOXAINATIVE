from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.collection_services import GettingCollectionInput
from domain.db_service.collection_services import GettingCollectionService
from domain.db_service.collection_services import PaginatedCollectionData
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings.models import PostgresSettings

logger = get_logger(__name__)


class CollectionGettingInput(BaseModel):
    """Input for collection getting app service"""
    page: int = 1
    page_size: int = 10
    user_id: Optional[uuid.UUID] = None
    search: Optional[str] = None


class CollectionGettingOutput(BaseModel):
    """Output for collection getting app service"""
    data: Optional[PaginatedCollectionData] = None
    message: str


class CollectionGettingService(BaseService):
    """App service for getting collections with pagination"""

    postgres_settings: PostgresSettings

    async def process(self, inputs: CollectionGettingInput, db_session=None) -> CollectionGettingOutput:
        """
        Process collection getting request with pagination

        Args:
            inputs: CollectionGettingInput with pagination parameters

        Returns:
            CollectionGettingOutput with paginated collection data
        """
        try:
            logger.info(
                f"Getting collections - page: {inputs.page}, "
                f"page_size: {inputs.page_size}, "
                f"user_id: {inputs.user_id}, search: {inputs.search}",
            )

            # Create domain service input
            domain_input = GettingCollectionInput(
                page=inputs.page,
                page_size=inputs.page_size,
                user_id=inputs.user_id,
                search=inputs.search,
            )

            # Initialize and run domain service
            domain_service = GettingCollectionService(
                settings=self.postgres_settings,
            )
            result = await domain_service.process(domain_input, db_session)

            if result.status:
                logger.info(
                    f"Successfully retrieved collections: {result.message}",
                )
                return CollectionGettingOutput(
                    data=result.data,
                    message=result.message,
                )
            else:
                logger.warning(
                    f"Failed to retrieve collections: {result.message}",
                )
                return CollectionGettingOutput(
                    data=None,
                    message=result.message,
                )

        except Exception as e:
            error_msg = f"Unexpected error getting collections: {str(e)}"
            logger.error(error_msg)
            return CollectionGettingOutput(
                data=None,
                message=error_msg,
            )
