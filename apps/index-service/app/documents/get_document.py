from __future__ import annotations

from typing import Optional

from domain.db_service.document_services.getting_document import GettingDocumentInput
from domain.db_service.document_services.getting_document import GettingDocumentService
from domain.db_service.document_services.getting_document import PaginatedDocumentData
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GetDocumentInput(BaseModel):
    """Input model for GetDocumentService"""
    page: int = 1
    page_size: int = 10
    collection_name: str  # Required - validated from collection_id
    search: Optional[str] = None
    processing_status: Optional[str] = None
    processing_type: Optional[str] = None


class GetDocumentOutput(BaseModel):
    """Output model for GetDocumentService"""
    data: Optional[PaginatedDocumentData] = None
    message: str


class GetDocumentService(BaseService):
    """Application service to handle document retrieval operations"""

    settings: PostgresSettings

    async def process(self, input: GetDocumentInput, db_session=None) -> GetDocumentOutput:
        """
        Process document retrieval request with pagination and filters

        Args:
            input: GetDocumentInput with pagination and filter parameters

        Returns:
            GetDocumentOutput with paginated document data
        """
        logger.info(f"Getting documents with filters: {input.model_dump()}")

        # Map app input to domain service input
        service_input = GettingDocumentInput(
            page=input.page,
            page_size=input.page_size,
            collection_name=input.collection_name,
            search=input.search,
            processing_status=input.processing_status,
            processing_type=input.processing_type,
        )

        # Execute domain service
        service = GettingDocumentService(settings=self.settings)
        result = await service.process(service_input, db_session)

        if not result.status:
            logger.error(f"Failed to get documents: {result.message}")
            return GetDocumentOutput(
                data=None,
                message=result.message,
            )

        logger.info(f"Successfully retrieved documents: {result.message}")
        return GetDocumentOutput(
            data=result.data,
            message=result.message,
        )
