from __future__ import annotations

import uuid
from typing import Optional

from domain.db_service.document_services.getting_document_by_id import DocumentWithCollectionName
from domain.db_service.document_services.getting_document_by_id import GettingDocumentByIdInput
from domain.db_service.document_services.getting_document_by_id import GettingDocumentByIdService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class GetDocumentByIdInput(BaseModel):
    """Input model for GetDocumentByIdService"""
    document_id: uuid.UUID


class GetDocumentByIdOutput(BaseModel):
    """Output model for GetDocumentByIdService"""
    data: Optional[DocumentWithCollectionName] = None
    message: str


class GetDocumentByIdService(BaseService):
    """Application service to handle document retrieval by ID operations"""

    settings: PostgresSettings

    async def process(self, input: GetDocumentByIdInput, db_session=None) -> GetDocumentByIdOutput:
        """
        Process document retrieval by ID request

        Args:
            input: GetDocumentByIdInput with document_id

        Returns:
            GetDocumentByIdOutput with document data including collection_name
        """
        logger.info(f"Getting document by ID: {input.document_id}")

        # Map app input to domain service input
        service_input = GettingDocumentByIdInput(
            document_id=input.document_id,
        )

        # Execute domain service
        service = GettingDocumentByIdService(settings=self.settings)
        result = await service.process(service_input, db_session)

        if not result.status:
            logger.error(f"Failed to get document by ID: {result.message}")
            return GetDocumentByIdOutput(
                data=None,
                message=result.message,
            )

        logger.info(f"Successfully retrieved document by ID: {result.message}")
        return GetDocumentByIdOutput(
            data=result.data,
            message=result.message,
        )
