from __future__ import annotations

import uuid
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import DocumentController
from joint.postgres.database.schemas import Document
from joint.settings.settings import PostgresSettings
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class GettingDocumentByIdInput(BaseModel):
    """Input model for GettingDocumentByIdService"""
    document_id: uuid.UUID


class DocumentWithCollectionName(Document):
    """Document schema extended with collection_name"""
    collection_name: str


class GettingDocumentByIdOutput(BaseModel):
    """Output model for GettingDocumentByIdService"""
    status: bool
    data: Optional[DocumentWithCollectionName] = None
    message: str = ''


class GettingDocumentByIdService(BaseService):
    """Service to handle document retrieval by ID with collection_name"""

    settings: PostgresSettings

    @property
    def postgres_db(self) -> SQLDatabase:
        """Get postgres_db instance"""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    @property
    def document_controller(self) -> DocumentController:
        """Get document controller instance"""
        return DocumentController()

    async def process(self, input: GettingDocumentByIdInput, session=None) -> GettingDocumentByIdOutput:
        """
        Get document by ID with collection_name

        Args:
            input: GettingDocumentByIdInput with document_id

        Returns:
            GettingDocumentByIdOutput with document data including collection_name
        """
        if session is not None:
            # Use provided session (from dependency injection)
            return await self._process_with_session(input, session)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return await self._process_with_session(input, session)
            except Exception as e:
                logger.error(f'Error getting document by ID: {str(e)}')
                return GettingDocumentByIdOutput(
                    status=False,
                    message=f"Failed to retrieve document: {str(e)}",
                )

    async def _process_with_session(self, input: GettingDocumentByIdInput, session: Session) -> GettingDocumentByIdOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Get document with collection_name using JOIN
            document_with_collection = self._get_document_with_collection_name(
                session, input.document_id,
            )

            if not document_with_collection:
                logger.info(f"Document not found with ID: {input.document_id}")
                return GettingDocumentByIdOutput(
                    status=False,
                    message='Document not found',
                )

            # CRITICAL: Exclude draft documents
            if document_with_collection.processing_status == 'draft':
                logger.warning(
                    f"Access to draft document denied: {input.document_id}",
                )
                return GettingDocumentByIdOutput(
                    status=False,
                    message='Document not found',
                )

            logger.info(
                f"Successfully retrieved document: {input.document_id}",
            )
            return GettingDocumentByIdOutput(
                status=True,
                data=document_with_collection,
                message='Document retrieved successfully',
            )

        except Exception as e:
            logger.error(
                f"Error getting document by ID {input.document_id}: {str(e)}",
            )
            return GettingDocumentByIdOutput(
                status=False,
                message=f"Failed to retrieve document: {str(e)}",
            )

    def _get_document_with_collection_name(
        self, session: Session, document_id: uuid.UUID,
    ) -> Optional[DocumentWithCollectionName]:
        """Get document with collection_name using JOIN"""
        try:
            from joint.postgres.models import Document as DocumentModel
            from joint.postgres.models import Collection as CollectionModel

            # JOIN documents with collections to get collection_name
            stmt = select(
                DocumentModel,
                CollectionModel.collection_name,
            ).select_from(
                DocumentModel.__table__.join(
                    CollectionModel.__table__,
                    DocumentModel.collection_id == CollectionModel.id,
                ),
            ).where(
                DocumentModel.id == document_id,
            )

            result = session.execute(stmt).first()

            if not result:
                return None

            document_model, collection_name = result

            # Convert DocumentModel to Document schema
            document_dict = Document.model_validate(
                document_model,
            ).model_dump()

            # Add collection_name to the dict
            document_dict['collection_name'] = collection_name

            # Create DocumentWithCollectionName instance
            return DocumentWithCollectionName(**document_dict)

        except Exception as e:
            logger.error(
                f"Error getting document with collection name: {str(e)}",
            )
            return None
