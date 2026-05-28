from __future__ import annotations

import datetime
import uuid

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import CollectionController
from joint.postgres.database import DocumentController
from joint.postgres.database.schemas import Document
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class CreatingDocumentInput(BaseModel):
    """Input model for CreatingDocumentService - Updated for new schema"""
    display_name: str
    file_name: str
    file_url: str
    file_type: str | None = None
    file_size: int | None = None

    # Processing status
    processing_status: str = 'pending'
    progress: int = 0
    current_step: str | None = None
    error_message: str | None = None
    # Optional during batch upload, required during batch process
    processing_type: str | None = None

    # Metadata
    collection_id: uuid.UUID
    user_id: uuid.UUID
    effective_from: datetime.datetime | None = None
    effective_to: datetime.datetime | None = None
    issuing_unit: str | None = None
    access_scope: str | None = None
    version: str | None = None
    completed_at: datetime.datetime | None = None


class CreatingDocumentOutput(BaseModel):
    """Output model for CreatingDocumentService"""
    status: bool
    already_exists: bool = False
    message: str = ''
    document_id: uuid.UUID | None = None


class CreatingDocumentService(BaseService):
    """Service to handle document creation operations"""

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

    @property
    def collection_controller(self) -> CollectionController:
        """Get collection controller instance"""
        return CollectionController()

    async def process(self, input: CreatingDocumentInput, session=None) -> CreatingDocumentOutput:
        """
        Create a new document in the database

        Args:
            input: CreatingDocumentInput with document details
            session: Optional database session (if None, creates new session)

        Returns:
            CreatingDocumentOutput with status
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
                    f'Error creating document {input.display_name}: {str(e)}',
                )
                return CreatingDocumentOutput(
                    status=False,
                    already_exists=False,
                    message=f"Failed to create document: {str(e)}",
                )

    async def _process_with_session(self, input: CreatingDocumentInput, session) -> CreatingDocumentOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Note: user_id is validated by JWT token from Keycloak
            # No need to check if user exists in local database

            # Check if collection exists (collection is in same database)
            existing_collection = self.collection_controller.get_by_id(
                session=session,
                id=input.collection_id,
            )

            if not existing_collection:
                raise ValueError(
                    f"Collection with ID {input.collection_id} does not exist",
                )

            # Check if document already exists in this collection
            existing_documents = self.document_controller.get_all(
                session=session,
                filter={
                    'display_name': input.display_name,
                    'collection_id': input.collection_id,
                },
                limit=1,
            )

            if existing_documents and len(existing_documents) > 0:
                existing_document = existing_documents[0]
                logger.info(
                    f'Document already exists: {existing_document.id} with name: {input.display_name}',
                )
                return CreatingDocumentOutput(
                    status=True,
                    already_exists=True,
                    message=f"Document '{input.display_name}' already exists in this collection",
                    document_id=existing_document.id,
                )

            # Create Document object with new schema
            document = Document(
                display_name=input.display_name,
                file_name=input.file_name,
                file_url=input.file_url,
                file_type=input.file_type,
                file_size=input.file_size,
                processing_status=input.processing_status,
                progress=input.progress,
                current_step=input.current_step,
                error_message=input.error_message,
                processing_type=input.processing_type,
                collection_id=input.collection_id,
                user_id=input.user_id,
                effective_from=input.effective_from,
                effective_to=input.effective_to,
                issuing_unit=input.issuing_unit,
                access_scope=input.access_scope,
                version=input.version,
                completed_at=input.completed_at,
            )

            # Insert document using controller
            saved_document = self.document_controller.insert(
                session=session,
                model=document,
            )

            logger.info(
                f'Successfully created document: {saved_document.id} with name: {input.display_name}',
            )

            return CreatingDocumentOutput(
                status=True,
                already_exists=False,
                message=f"Document '{input.display_name}' created successfully",
                document_id=saved_document.id,
            )

        except Exception as e:
            logger.error(
                f'Error creating document {input.display_name}: {str(e)}',
            )
            return CreatingDocumentOutput(
                status=False,
                already_exists=False,
                message=f"Failed to create document: {str(e)}",
            )
