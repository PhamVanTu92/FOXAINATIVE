from __future__ import annotations

import uuid
from typing import Any
from typing import List
from typing import Optional

from functools import cached_property

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ConversationController
from joint.postgres.database.schemas import Conversation
from joint.settings.settings import PostgresSettings
from sqlalchemy import func
from sqlalchemy import select


logger = get_logger(__name__)


class PaginatedConversationData(BaseModel):
    """Paginated conversation data model"""
    conversations: List[Conversation]
    total: int
    page: int
    page_size: int
    total_pages: int


class GettingConversationPaginationInput(BaseModel):
    """
    Input model for getting conversations service with pagination.
    Contains user_id, pagination parameters, and search query.
    """
    user_id: uuid.UUID
    page: int = 1
    page_size: int = 10
    include_deleted: bool = False
    search_query: Optional[str] = None


class GettingConversationPaginationOutput(BaseModel):
    """
    Output model for getting conversations service with pagination.
    Contains status, message, and paginated conversation data.
    """
    status: bool
    message: str = ''
    data: Optional[PaginatedConversationData] = None


class GettingConversationPaginationService(BaseService):
    """Service to handle conversation retrieval operations with pagination"""

    settings: PostgresSettings

    @cached_property
    def postgres_db(self) -> SQLDatabase:
        """Get shared postgres_db instance (cached per service)."""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    @property
    def conversation_controller(self) -> ConversationController:
        """Get conversation controller instance"""
        return ConversationController()

    def process(
        self,
        input: GettingConversationPaginationInput,
        db=None,
    ) -> GettingConversationPaginationOutput:
        """
        Get paginated conversations with filtering

        Args:
            input: GettingConversationPaginationInput with pagination and filter options
            db: Optional database session (if None, creates new session)

        Returns:
            GettingConversationPaginationOutput with paginated conversation data
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(f"Error getting conversations: {str(e)}")
                return GettingConversationPaginationOutput(
                    status=False,
                    message=f"Failed to retrieve conversations: {str(e)}",
                )

    def _process_with_session(self, input: GettingConversationPaginationInput, db) -> GettingConversationPaginationOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Validate pagination parameters
            if input.page < 1:
                return GettingConversationPaginationOutput(
                    status=False,
                    message='Page number must be >= 1',
                )

            if input.page_size < 1 or input.page_size > 100:
                return GettingConversationPaginationOutput(
                    status=False,
                    message='Page size must be between 1 and 100',
                )

            # Build filter conditions
            filter_conditions: dict[str, Any] = {'user_id': input.user_id}
            if not input.include_deleted:
                filter_conditions['deleted'] = False

            # Get total count for pagination
            total_conversations = self._get_total_count(
                db, filter_conditions, input.search_query,
            )

            # Calculate pagination info
            total_pages = (
                total_conversations + input.page_size -
                1
            ) // input.page_size if total_conversations > 0 else 0

            # Handle case when no conversations exist
            if total_conversations == 0:
                logger.info(
                    f"No conversations found for user: {input.user_id}",
                )
                return GettingConversationPaginationOutput(
                    status=True,
                    data=PaginatedConversationData(
                        conversations=[],
                        total=0,
                        page=input.page,
                        page_size=input.page_size,
                        total_pages=0,
                    ),
                    message='No conversations found',
                )

            # Handle case when requested page is beyond available pages
            if input.page > total_pages:
                logger.warning(
                    f"Requested page {input.page} exceeds total pages {total_pages}",
                )
                return GettingConversationPaginationOutput(
                    status=False,
                    message=f"Page {input.page} not found. Total pages available: {total_pages}",
                )

            # Calculate offset for SQL query
            # Page 1: offset = 0, Page 2: offset = page_size, etc.
            offset = (input.page - 1) * input.page_size

            # Get paginated conversations
            conversations = self._get_paginated_conversations(
                db, filter_conditions, offset, input.page_size, input.search_query,
            )

            # This should not happen if our logic is correct, but just in case
            if not conversations:
                return GettingConversationPaginationOutput(
                    status=False,
                    message=f"No conversations found for page {input.page}",
                )

            logger.info(
                f"Retrieved {len(conversations)} conversations "
                f"(page {input.page}/{total_pages}, total: {total_conversations}) "
                f"for user: {input.user_id}",
            )

            return GettingConversationPaginationOutput(
                status=True,
                data=PaginatedConversationData(
                    conversations=conversations,
                    total=total_conversations,
                    page=input.page,
                    page_size=input.page_size,
                    total_pages=total_pages,
                ),
                message=f"Successfully retrieved {len(conversations)} conversations",
            )

        except Exception as e:
            logger.error(f"Error getting conversations: {str(e)}")
            return GettingConversationPaginationOutput(
                status=False,
                message=f"Failed to retrieve conversations: {str(e)}",
            )

    def _get_total_count(self, session, filter_conditions: dict, search_query: Optional[str] = None) -> int:
        """Get total count of conversations matching filter conditions"""
        try:
            from joint.postgres.models import Conversation as ConversationModel

            stmt = select(func.count(ConversationModel.id))
            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if search_query is provided
            if search_query:
                stmt = stmt.where(
                    ConversationModel.title.ilike(f"%{search_query}%"),
                )

            result = session.execute(stmt).scalar()
            return result or 0
        except Exception as e:
            logger.error(f"Error getting total count: {str(e)}")
            return 0

    def _get_paginated_conversations(
        self, session, filter_conditions: dict, offset: int, limit: int, search_query: Optional[str] = None,
    ) -> List[Conversation]:
        """Get paginated conversations using conversation controller"""
        try:
            from joint.postgres.models import Conversation as ConversationModel

            # Use direct SQLAlchemy query for pagination with offset
            stmt = select(ConversationModel)
            if filter_conditions:
                stmt = stmt.filter_by(**filter_conditions)

            # Add search filter if search_query is provided
            if search_query:
                stmt = stmt.where(
                    ConversationModel.title.ilike(f"%{search_query}%"),
                )

            # Order by updated_at DESC to get most recently updated first
            stmt = stmt.order_by(ConversationModel.updated_at.desc())
            stmt = stmt.offset(offset).limit(limit)

            results = session.execute(stmt).scalars().all()

            # Convert to schemas
            return [Conversation.model_validate(result) for result in results]

        except Exception as e:
            logger.error(f"Error getting paginated conversations: {str(e)}")
            return []
