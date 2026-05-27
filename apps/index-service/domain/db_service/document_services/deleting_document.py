from __future__ import annotations

import uuid

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import DocumentController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class DeletingDocumentInput(BaseModel):
    """Input model for DeletingDocumentService"""
    document_id: uuid.UUID


class DeletingDocumentOutput(BaseModel):
    """Output model for DeletingDocumentService"""
    status: bool
    document_name: str
    message: str


class DeletingDocumentService(BaseService):
    """Service to handle document deletion operations"""

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

    async def process(self, input: DeletingDocumentInput, session=None) -> DeletingDocumentOutput:
        """
        Delete a document from the database

        Args:
            input: DeletingDocumentInput with document_id

        Returns:
            DeletingDocumentOutput with status and document info
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
                logger.error(
                    f'Error deleting document {input.document_id}: {str(e)}',
                )
                return DeletingDocumentOutput(
                    status=False,
                    document_name='',
                    message=f"Failed to delete document: {str(e)}",
                )

    async def _process_with_session(self, input: DeletingDocumentInput, session) -> DeletingDocumentOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Find document by ID
            document = self.document_controller.get_by_id(
                session=session,
                id=input.document_id,
            )

            if not document:
                logger.warning(
                    f'Document not found with ID: {input.document_id}',
                )
                return DeletingDocumentOutput(
                    status=False,
                    document_name='',
                    message=f"Document with ID '{input.document_id}' not found",
                )

            # Use display_name as document_name (without extension)
            document_name = document.display_name
            logger.info(
                f'Found document to delete: {document_name} (ID: {input.document_id})',
            )

            # Delete document using controller
            deleted_document = self.document_controller.delete(
                session=session,
                id=input.document_id,
            )

            if deleted_document:
                logger.info(
                    f'Successfully deleted document: {document_name} (ID: {input.document_id})',
                )
                return DeletingDocumentOutput(
                    status=True,
                    document_name=document_name,
                    message=f"Document '{document_name}' deleted successfully",
                )
            else:
                logger.error(
                    f'Failed to delete document: {document_name} (ID: {input.document_id})',
                )
                return DeletingDocumentOutput(
                    status=False,
                    document_name=document_name,
                    message=f"Failed to delete document '{document_name}'",
                )

        except Exception as e:
            logger.error(
                f'Error deleting document with ID {input.document_id}: {str(e)}',
            )
            return DeletingDocumentOutput(
                status=False,
                document_name='',
                message=f"Failed to delete document: {str(e)}",
            )
