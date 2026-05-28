from __future__ import annotations

from typing import Optional

from domain.db_service.collection_services.getting_collection_description import GettingCollectionDescriptionInput
from domain.db_service.collection_services.getting_collection_description import GettingCollectionDescriptionService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GetCollectionDescriptionInput(BaseModel):
    """Input model for GetCollectionDescriptionService."""

    collection_name: str


class GetCollectionDescriptionOutput(BaseModel):
    """Output model for GetCollectionDescriptionService."""

    description: Optional[str] = None
    collection_name: str = ''
    message: str


class GetCollectionDescriptionService(BaseService):
    """Application service to handle collection description retrieval."""

    settings: PostgresSettings

    async def process(
        self,
        input: GetCollectionDescriptionInput,
        db_session=None,
    ) -> GetCollectionDescriptionOutput:
        """
        Process collection description retrieval request.

        Args:
            input: GetCollectionDescriptionInput with collection_name.
            db_session: Optional database session from dependency injection.

        Returns:
            GetCollectionDescriptionOutput with description.
        """
        logger.info(
            f"Getting description for collection: {input.collection_name}",
        )

        service_input = GettingCollectionDescriptionInput(
            collection_name=input.collection_name,
        )

        service = GettingCollectionDescriptionService(settings=self.settings)
        result = service.process(service_input, db_session)

        if not result.status:
            logger.error(
                f"Failed to get collection description: {result.message}",
            )
            return GetCollectionDescriptionOutput(
                collection_name=input.collection_name,
                message=result.message,
            )

        logger.info(
            f"Successfully retrieved description for collection: "
            f"{input.collection_name}",
        )
        return GetCollectionDescriptionOutput(
            description=result.description,
            collection_name=input.collection_name,
            message=result.message,
        )
