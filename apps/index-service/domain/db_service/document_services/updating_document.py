from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import DocumentController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class UpdatingDocumentInput(BaseModel):
    """Input model for updating document processing status and progress"""
    document_id: UUID
    # draft, pending, processing, completed, failed
    processing_status: Optional[str] = None
    processing_type: Optional[str] = None  # Allow updating processing_type
    progress: Optional[int] = None  # 0-100
    # uploading, parsing, embedding, saving, completed
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    file_url: Optional[str] = None  # MinIO URL after upload
    completed_at: Optional[datetime] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    issuing_unit: Optional[str] = None
    access_scope: Optional[str] = None
    version: Optional[str] = None


class UpdatingDocumentOutput(BaseModel):
    """Output model for document update operations"""
    status: bool
    message: str = ''


class UpdatingDocumentService(BaseService):
    """Service to handle document status and progress updates during background processing"""

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

    async def process(self, input: UpdatingDocumentInput, session=None) -> UpdatingDocumentOutput:
        """
        Update document processing status and progress

        Args:
            input: UpdatingDocumentInput with document_id and fields to update
            session: Optional database session (for transaction support)

        Returns:
            UpdatingDocumentOutput with status and message
        """
        if session is not None:
            return await self._process_with_session(input, session)
        else:
            try:
                with self.postgres_db.sessionmaker() as session:
                    return await self._process_with_session(input, session)
            except Exception as e:
                logger.error(
                    f'Error updating document {input.document_id}: {str(e)}',
                )
                return UpdatingDocumentOutput(
                    status=False,
                    message=f"Failed to update document: {str(e)}",
                )

    async def _process_with_session(self, input: UpdatingDocumentInput, session) -> UpdatingDocumentOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # First, get the existing document
            from joint.postgres.database.schemas import Document
            existing_doc = self.document_controller.get_by_id(
                session=session, id=input.document_id,
            )

            if not existing_doc:
                return UpdatingDocumentOutput(
                    status=False,
                    message=f"Document not found: {input.document_id}",
                )

            # Create updated document model with all fields
            # Start with existing values, then override with provided values
            updated_doc = Document(
                id=existing_doc.id,
                created_at=existing_doc.created_at,
                updated_at=datetime.now(),
                display_name=existing_doc.display_name,
                file_name=existing_doc.file_name,
                file_url=input.file_url if input.file_url is not None else existing_doc.file_url,
                file_type=existing_doc.file_type,
                file_size=existing_doc.file_size,
                processing_status=input.processing_status if input.processing_status is not None else existing_doc.processing_status,
                progress=input.progress if input.progress is not None else existing_doc.progress,
                current_step=input.current_step if input.current_step is not None else existing_doc.current_step,
                error_message=input.error_message if input.error_message is not None else existing_doc.error_message,
                processing_type=input.processing_type if input.processing_type is not None else existing_doc.processing_type,
                effective_from=input.effective_from if input.effective_from is not None else existing_doc.effective_from,
                effective_to=input.effective_to if input.effective_to is not None else existing_doc.effective_to,
                issuing_unit=input.issuing_unit if input.issuing_unit is not None else existing_doc.issuing_unit,
                access_scope=input.access_scope if input.access_scope is not None else existing_doc.access_scope,
                version=input.version if input.version is not None else existing_doc.version,
                completed_at=input.completed_at if input.completed_at is not None else existing_doc.completed_at,
                collection_id=existing_doc.collection_id,
                user_id=existing_doc.user_id,
            )

            # Update document using controller
            result = self.document_controller.update(
                session=session,
                model=updated_doc,
            )

            if not result:
                return UpdatingDocumentOutput(
                    status=False,
                    message=f"Failed to update document: {input.document_id}",
                )

            session.commit()

            logger.info(
                f"Successfully updated document {input.document_id}: "
                f"status={input.processing_status}, progress={input.progress}%, step={input.current_step}",
            )

            return UpdatingDocumentOutput(
                status=True,
                message='Document updated successfully',
            )

        except Exception as e:
            session.rollback()
            logger.error(
                f"Error updating document {input.document_id}: {str(e)}",
            )
            return UpdatingDocumentOutput(
                status=False,
                message=f"Failed to update document: {str(e)}",
            )
