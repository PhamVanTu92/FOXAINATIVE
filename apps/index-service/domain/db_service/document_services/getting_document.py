from __future__ import annotations

from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import DocumentController
from joint.postgres.database.schemas import Document
from joint.settings.settings import PostgresSettings
from sqlalchemy import func
from sqlalchemy import select

logger = get_logger(__name__)


class GettingDocumentInput(BaseModel):
    """Input model for GettingDocumentService"""
    page: int = 1
    page_size: int = 10
    collection_name: str  # Required - specific collection to get documents from
    search: Optional[str] = None
    # Filter by status: pending, processing, completed, failed
    processing_status: Optional[str] = None
    # Filter by type: 'excel' or 'document_structured_llm', or None
    processing_type: Optional[str] = None


class PaginatedDocumentData(BaseModel):
    """Paginated document data response"""
    documents: List[Document]
    total: int
    page: int
    page_size: int
    total_pages: int


class GettingDocumentOutput(BaseModel):
    """Output model for GettingDocumentService"""
    status: bool
    data: Optional[PaginatedDocumentData] = None
    message: str = ''


class GettingDocumentService(BaseService):
    """Service to handle document retrieval operations with pagination"""

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

    async def process(self, input: GettingDocumentInput, session=None) -> GettingDocumentOutput:
        """
        Get paginated documents with optional filtering

        Args:
            input: GettingDocumentInput with pagination and filter options

        Returns:
            GettingDocumentOutput with paginated document data
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
                logger.error(f'Error getting documents: {str(e)}')
                return GettingDocumentOutput(
                    status=False,
                    message=f"Failed to retrieve documents: {str(e)}",
                )

    async def _process_with_session(self, input: GettingDocumentInput, session) -> GettingDocumentOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Validate pagination parameters
            if input.page < 1:
                return GettingDocumentOutput(
                    status=False,
                    message='Page number must be >= 1',
                )

            if input.page_size < 1 or input.page_size > 100:
                return GettingDocumentOutput(
                    status=False,
                    message='Page size must be between 1 and 100',
                )

            # Build filter conditions - collection_name is always provided
            filter_conditions = {
                'collection_name': input.collection_name,
            }

            # CRITICAL: Always exclude 'draft' documents from results
            # Draft documents are not committed and should not be visible to users
            filter_conditions['processing_status__ne'] = 'draft'

            # Add processing_status filter if provided (in addition to excluding draft)
            if input.processing_status:
                filter_conditions['processing_status'] = input.processing_status

            # Add processing_type filter if provided
            if input.processing_type is not None:
                filter_conditions['processing_type'] = input.processing_type

            # Get total count for pagination
            total_documents = self._get_total_count(
                session, filter_conditions, input.search,
            )

            # Calculate pagination info
            total_pages = (
                total_documents + input.page_size -
                1
            ) // input.page_size if total_documents > 0 else 0

            # Handle case when no documents exist
            if total_documents == 0:
                logger.info('No documents found with given filters')
                return GettingDocumentOutput(
                    status=True,
                    data=PaginatedDocumentData(
                        documents=[],
                        total=0,
                        page=input.page,
                        page_size=input.page_size,
                        total_pages=0,
                    ),
                    message='No documents found',
                )

            # Handle case when requested page is beyond available pages
            if input.page > total_pages:
                logger.warning(
                    f"Requested page {input.page} exceeds total pages {total_pages}",
                )
                return GettingDocumentOutput(
                    status=False,
                    message=f"Page {input.page} not found. Total pages available: {total_pages}",
                )

            # Calculate offset for SQL query
            # Page 1: offset = 0, Page 2: offset = page_size, etc.
            offset = (input.page - 1) * input.page_size

            # Get paginated documents
            documents = self._get_paginated_documents(
                session, filter_conditions, offset, input.page_size, input.search,
            )

            # This should not happen if our logic is correct, but just in case
            if not documents:
                return GettingDocumentOutput(
                    status=False,
                    message=f"No documents found for page {input.page}",
                )

            logger.info(
                f"Retrieved {len(documents)} documents "
                f"(page {input.page}/{total_pages}, total: {total_documents})",
            )

            return GettingDocumentOutput(
                status=True,
                data=PaginatedDocumentData(
                    documents=documents,
                    total=total_documents,
                    page=input.page,
                    page_size=input.page_size,
                    total_pages=total_pages,
                ),
                message=f"Successfully retrieved {len(documents)} documents",
            )

        except Exception as e:
            logger.error(f"Error getting documents: {str(e)}")
            return GettingDocumentOutput(
                status=False,
                message=f"Failed to retrieve documents: {str(e)}",
            )

    def _get_total_count(self, session, filter_conditions: dict, search: Optional[str] = None) -> int:
        """Get total count of documents matching filter conditions and search"""
        try:
            from joint.postgres.models import Document as DocumentModel
            from joint.postgres.models import Collection as CollectionModel

            # Always JOIN with collections table since we always filter by collection_name
            stmt = select(func.count(DocumentModel.id)).select_from(
                DocumentModel.__table__.join(CollectionModel.__table__),
            )

            # Filter by collection_name (always present)
            stmt = stmt.where(
                CollectionModel.collection_name ==
                filter_conditions['collection_name'],
            )

            # CRITICAL: Always exclude draft documents
            if 'processing_status__ne' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_status !=
                    filter_conditions['processing_status__ne'],
                )

            # Add processing_status filter if provided
            if 'processing_status' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_status ==
                    filter_conditions['processing_status'],
                )

            # Add processing_type filter if provided
            if 'processing_type' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_type ==
                    filter_conditions['processing_type'],
                )

            # Add search filter if provided
            if search:
                search_term = f"%{search}%"
                stmt = stmt.where(
                    DocumentModel.display_name.ilike(search_term),
                )

            result = session.execute(stmt).scalar()
            return result or 0
        except Exception as e:
            logger.error(f"Error getting total count: {str(e)}")
            return 0

    def _get_paginated_documents(
        self, session, filter_conditions: dict, offset: int, limit: int, search: Optional[str] = None,
    ) -> List[Document]:
        """Get paginated documents using document controller"""
        try:
            from joint.postgres.models import Document as DocumentModel
            from joint.postgres.models import Collection as CollectionModel

            # Always JOIN with collections table since we always filter by collection_name
            stmt = select(DocumentModel).select_from(
                DocumentModel.__table__.join(CollectionModel.__table__),
            )

            # Filter by collection_name (always present)
            stmt = stmt.where(
                CollectionModel.collection_name ==
                filter_conditions['collection_name'],
            )

            # CRITICAL: Always exclude draft documents
            if 'processing_status__ne' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_status !=
                    filter_conditions['processing_status__ne'],
                )

            # Add processing_status filter if provided
            if 'processing_status' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_status ==
                    filter_conditions['processing_status'],
                )

            # Add processing_type filter if provided
            if 'processing_type' in filter_conditions:
                stmt = stmt.where(
                    DocumentModel.processing_type ==
                    filter_conditions['processing_type'],
                )

            # Add search filter if provided
            if search:
                search_term = f"%{search}%"
                stmt = stmt.where(
                    DocumentModel.display_name.ilike(search_term),
                )

            stmt = stmt.order_by(DocumentModel.created_at.desc())
            stmt = stmt.offset(offset).limit(limit)

            results = session.execute(stmt).scalars().all()

            # Convert to schemas
            return [Document.model_validate(result) for result in results]

        except Exception as e:
            logger.error(f"Error getting paginated documents: {str(e)}")
            return []
