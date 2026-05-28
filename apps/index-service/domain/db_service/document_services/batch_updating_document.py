from __future__ import annotations

from datetime import datetime
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import DocumentController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class BatchUpdatingDocumentInput(BaseModel):
    """Input model for batch updating multiple documents with shared metadata"""
    document_ids: List[UUID]

    # Shared metadata to apply to all documents
    processing_type: str
    # Allow updating status (draft -> pending)
    processing_status: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    issuing_unit: Optional[str] = None
    access_scope: Optional[str] = None
    version: Optional[str] = None


class BatchUpdatingDocumentOutput(BaseModel):
    """Output model for batch document update operations"""
    status: bool
    message: str = ''
    successful_count: int = 0
    failed_count: int = 0
    total_count: int = 0


class BatchUpdatingDocumentService(BaseService):
    """
    Service to handle bulk update of multiple documents with shared metadata.
    Optimized for performance using SQLAlchemy bulk update operations.
    """

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

    async def process(self, input: BatchUpdatingDocumentInput, session=None) -> BatchUpdatingDocumentOutput:
        """
        Update multiple documents with shared metadata using bulk operations.

        Args:
            input: BatchUpdatingDocumentInput with document_ids and shared metadata
            session: Optional database session (for transaction support)

        Returns:
            BatchUpdatingDocumentOutput with status and counts
        """
        if session is not None:
            return await self._process_with_session(input, session)
        else:
            try:
                with self.postgres_db.sessionmaker() as session:
                    return await self._process_with_session(input, session)
            except Exception as e:
                logger.error(f'Error batch updating documents: {str(e)}')
                return BatchUpdatingDocumentOutput(
                    status=False,
                    message=f"Failed to batch update documents: {str(e)}",
                    total_count=len(input.document_ids),
                )

    async def _process_with_session(self, input: BatchUpdatingDocumentInput, session) -> BatchUpdatingDocumentOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            total_count = len(input.document_ids)

            if total_count == 0:
                return BatchUpdatingDocumentOutput(
                    status=False,
                    message='No document IDs provided',
                    total_count=0,
                )

            # Build update data dictionary (only include fields that are provided)
            update_data: Dict[str, Any] = {}

            # processing_type is required
            update_data['processing_type'] = input.processing_type

            # processing_status is optional (for draft -> pending transition)
            if input.processing_status is not None:
                update_data['processing_status'] = input.processing_status

            if input.effective_from is not None:
                update_data['effective_from'] = input.effective_from

            if input.effective_to is not None:
                update_data['effective_to'] = input.effective_to

            if input.issuing_unit is not None:
                update_data['issuing_unit'] = input.issuing_unit

            if input.access_scope is not None:
                update_data['access_scope'] = input.access_scope

            if input.version is not None:
                update_data['version'] = input.version

            if not update_data:
                return BatchUpdatingDocumentOutput(
                    status=False,
                    message='No fields to update',
                    total_count=total_count,
                )

            # Use SQLAlchemy bulk update for better performance
            from joint.postgres.models import Document as DocumentModel

            # Update all documents in one query
            result = session.query(DocumentModel).filter(
                DocumentModel.id.in_(input.document_ids),
            ).update(
                update_data,
                synchronize_session=False,  # Better performance
            )

            session.commit()

            successful_count = result  # Number of rows updated
            failed_count = total_count - successful_count

            logger.info(
                f"Batch updated {successful_count}/{total_count} documents with metadata: "
                f"processing_type={input.processing_type}",
            )

            return BatchUpdatingDocumentOutput(
                status=True,
                message=f"Successfully updated {successful_count}/{total_count} documents",
                successful_count=successful_count,
                failed_count=failed_count,
                total_count=total_count,
            )

        except Exception as e:
            session.rollback()
            logger.error(f"Error batch updating documents: {str(e)}")
            return BatchUpdatingDocumentOutput(
                status=False,
                message=f"Failed to batch update documents: {str(e)}",
                total_count=len(input.document_ids),
            )
