from __future__ import annotations

import uuid
from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import CollectionController
from joint.postgres.database.schemas import Collection
from joint.settings.settings import PostgresSettings
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class GettingCollectionInput(BaseModel):
    """Input model for GettingCollectionService"""
    page: int = 1
    page_size: int = 10
    user_id: Optional[uuid.UUID] = None
    search: Optional[str] = None


class PaginatedCollectionData(BaseModel):
    """Paginated collection data response"""
    collections: List[Collection]
    total: int
    page: int
    page_size: int
    total_pages: int


class GettingCollectionOutput(BaseModel):
    """Output model for GettingCollectionService"""
    status: bool
    data: Optional[PaginatedCollectionData] = None
    message: str = ''


class GettingCollectionService(BaseService):
    """Service to handle collection retrieval operations with pagination"""

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
    def collection_controller(self) -> CollectionController:
        """Get collection controller instance"""
        return CollectionController()

    async def process(
        self,
        input: GettingCollectionInput,
        db: Session = None,
    ) -> GettingCollectionOutput:
        """
        Get paginated collections with optional filtering

        Args:
            input: GettingCollectionInput with pagination and filter options
            session: Optional database session (if None, creates new session)

        Returns:
            GettingCollectionOutput with paginated collection data
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return await self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return await self._process_with_session(input, session)
            except Exception as e:
                logger.error(f'Error getting collections: {str(e)}')
                return GettingCollectionOutput(
                    status=False,
                    message=f"Failed to retrieve collections: {str(e)}",
                )

    async def _process_with_session(self, input: GettingCollectionInput, db: Session) -> GettingCollectionOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Validate pagination parameters
            if input.page < 1:
                return GettingCollectionOutput(
                    status=False,
                    message='Page number must be >= 1',
                )

            if input.page_size < 1 or input.page_size > 100:
                return GettingCollectionOutput(
                    status=False,
                    message='Page size must be between 1 and 100',
                )

            # Build filter conditions
            filter_conditions = {}
            if input.user_id:
                filter_conditions['user_id'] = input.user_id

            # Get total count for pagination
            total_collections = self._get_total_count(
                db, filter_conditions, input.search,
            )

            # Calculate pagination info
            total_pages = (
                total_collections + input.page_size -
                1
            ) // input.page_size if total_collections > 0 else 0

            # Handle case when no collections exist
            if total_collections == 0:
                logger.info('No collections found with given filters')
                return GettingCollectionOutput(
                    status=True,
                    data=PaginatedCollectionData(
                        collections=[],
                        total=0,
                        page=input.page,
                        page_size=input.page_size,
                        total_pages=0,
                    ),
                    message='No collections found',
                )

            # Handle case when requested page is beyond available pages
            if input.page > total_pages:
                logger.warning(
                    f"Requested page {input.page} exceeds total pages {total_pages}",
                )
                return GettingCollectionOutput(
                    status=False,
                    message=f"Page {input.page} not found. Total pages available: {total_pages}",
                )

            # Calculate offset for SQL query
            # Page 1: offset = 0, Page 2: offset = page_size, etc.
            offset = (input.page - 1) * input.page_size

            # Get paginated collections
            collections = self._get_paginated_collections(
                db, filter_conditions, offset, input.page_size, input.search,
            )

            # This should not happen if our logic is correct, but just in case
            if not collections:
                return GettingCollectionOutput(
                    status=False,
                    message=f"No collections found for page {input.page}",
                )

            logger.info(
                f"Retrieved {len(collections)} collections "
                f"(page {input.page}/{total_pages}, total: {total_collections})",
            )

            return GettingCollectionOutput(
                status=True,
                data=PaginatedCollectionData(
                    collections=collections,
                    total=total_collections,
                    page=input.page,
                    page_size=input.page_size,
                    total_pages=total_pages,
                ),
                message=f"Successfully retrieved {len(collections)} collections",
            )

        except Exception as e:
            logger.error(f"Error getting collections: {str(e)}")
            return GettingCollectionOutput(
                status=False,
                message=f"Failed to retrieve collections: {str(e)}",
            )

    def _get_total_count(self, session, filter_conditions: dict, search: Optional[str] = None) -> int:
        """Get total count of collections matching filter conditions and search"""
        try:
            from joint.postgres.models import Collection as CollectionModel

            stmt = select(func.count(CollectionModel.id))
            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if provided
            if search:
                search_term = f"%{search}%"
                stmt = stmt.where(
                    CollectionModel.collection_name.ilike(search_term) |
                    CollectionModel.description.ilike(search_term),
                )

            result = session.execute(stmt).scalar()
            return result or 0
        except Exception as e:
            logger.error(f"Error getting total count: {str(e)}")
            return 0

    def _get_paginated_collections(
        self, session, filter_conditions: dict, offset: int, limit: int, search: Optional[str] = None,
    ) -> List[Collection]:
        """Get paginated collections using collection controller"""
        try:
            from joint.postgres.models import Collection as CollectionModel

            # Use direct SQLAlchemy query for pagination with offset
            stmt = select(CollectionModel)
            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if provided
            if search:
                search_term = f"%{search}%"
                stmt = stmt.where(
                    CollectionModel.collection_name.ilike(search_term) |
                    CollectionModel.description.ilike(search_term),
                )

            stmt = stmt.order_by(CollectionModel.created_at.desc())
            stmt = stmt.offset(offset).limit(limit)

            results = session.execute(stmt).scalars().all()

            # Convert to schemas
            return [Collection.model_validate(result) for result in results]

        except Exception as e:
            logger.error(f"Error getting paginated collections: {str(e)}")
            return []
