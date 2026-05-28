from __future__ import annotations

from typing import List
from typing import Optional

from domain.db_service.document_services.getting_document_names import GettingDocumentNamesInput
from domain.db_service.document_services.getting_document_names import GettingDocumentNamesService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GetDocumentNamesInput(BaseModel):
    """Input model for GetDocumentNamesService."""

    collection_name: str
    processing_status: Optional[str] = 'completed'


class GetDocumentNamesOutput(BaseModel):
    """Output model for GetDocumentNamesService."""

    document_names: List[str] = []
    total: int = 0
    message: str


class GetDocumentNamesService(BaseService):
    """Application service to handle document name retrieval operations."""

    settings: PostgresSettings

    async def process(
        self,
        input: GetDocumentNamesInput,
        db_session=None,
    ) -> GetDocumentNamesOutput:
        """
        Process document names retrieval request.

        Args:
            input: GetDocumentNamesInput with collection_name and filters.
            db_session: Optional database session from dependency injection.

        Returns:
            GetDocumentNamesOutput with document names list.
        """
        logger.info(
            f"Getting document names for collection: {input.collection_name}",
        )

        service_input = GettingDocumentNamesInput(
            collection_name=input.collection_name,
            processing_status=input.processing_status,
        )

        service = GettingDocumentNamesService(settings=self.settings)
        result = await service.process(service_input, db_session)

        if not result.status:
            logger.error(f"Failed to get document names: {result.message}")
            return GetDocumentNamesOutput(
                message=result.message,
            )

        logger.info(f"Successfully retrieved document names: {result.message}")
        return GetDocumentNamesOutput(
            document_names=result.document_names,
            total=result.total,
            message=result.message,
        )
