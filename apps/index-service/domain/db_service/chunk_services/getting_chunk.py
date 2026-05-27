from __future__ import annotations

from typing import List
from typing import Optional
from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ChunkController
from joint.postgres.database.schemas import Chunk
from joint.postgres.models import Chunk as ChunkModel
from joint.settings.settings import PostgresSettings
from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import cast as sa_cast
from sqlalchemy import String

logger = get_logger(__name__)


class GettingChunkInput(BaseModel):
    """Input for getting paginated chunks."""
    document_id: UUID
    page: int = 1
    page_size: int = 10
    include_disabled: bool = False
    include_deleted: bool = False
    search: Optional[str] = None


class PaginatedChunkData(BaseModel):
    """Paginated chunk data response."""
    chunks: List[Chunk]
    total: int
    enabled: int
    disabled: int
    page: int
    page_size: int
    total_pages: int


class GettingChunkOutput(BaseModel):
    """Output for getting chunks."""
    status: bool
    data: Optional[PaginatedChunkData] = None
    message: str = ''


class GettingChunkService(BaseService):
    """Service to retrieve paginated chunks with filtering and search."""

    settings: PostgresSettings

    @property
    def postgres_db(self) -> SQLDatabase:
        """Get postgres_db instance."""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    @property
    def chunk_controller(self) -> ChunkController:
        """Get chunk controller instance."""
        return ChunkController()

    async def process(
        self, input: GettingChunkInput, session=None,
    ) -> GettingChunkOutput:
        """Get paginated chunks with optional filtering.

        Args:
            input: Pagination and filter options.
            session: Optional database session.

        Returns:
            GettingChunkOutput with paginated chunk data.
        """
        if session is not None:
            return await self._process_with_session(input, session)

        try:
            with self.postgres_db.sessionmaker() as session:
                return await self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error getting chunks: {str(e)}')
            return GettingChunkOutput(
                status=False,
                message=f'Failed to retrieve chunks: {str(e)}',
            )

    async def _process_with_session(
        self, input: GettingChunkInput, session,
    ) -> GettingChunkOutput:
        """Internal method with provided session."""
        try:
            if input.page < 1:
                return GettingChunkOutput(
                    status=False, message='Page number must be >= 1',
                )
            if input.page_size < 1 or input.page_size > 100:
                return GettingChunkOutput(
                    status=False, message='Page size must be between 1 and 100',
                )

            # Get statistics and total count
            total, enabled, disabled = self._get_stats(
                session, input.document_id, input.include_disabled,
                input.include_deleted, input.search,
            )
            total_pages = (total + input.page_size - 1) // input.page_size if total > 0 else 0

            if total == 0:
                return GettingChunkOutput(
                    status=True,
                    data=PaginatedChunkData(
                        chunks=[], total=0, enabled=0, disabled=0,
                        page=input.page, page_size=input.page_size, total_pages=0,
                    ),
                    message='No chunks found',
                )

            if input.page > total_pages:
                return GettingChunkOutput(
                    status=False,
                    message=f'Page {input.page} not found. Total pages: {total_pages}',
                )

            # Get paginated chunks
            offset = (input.page - 1) * input.page_size
            chunks = self._get_chunks(
                session, input.document_id, input.include_disabled,
                input.include_deleted, input.search, input.page_size, offset,
            )

            return GettingChunkOutput(
                status=True,
                data=PaginatedChunkData(
                    chunks=chunks, total=total, enabled=enabled,
                    disabled=disabled, page=input.page,
                    page_size=input.page_size, total_pages=total_pages,
                ),
                message=f'Successfully retrieved {len(chunks)} chunks',
            )

        except Exception as e:
            logger.error(f'Error in _process_with_session: {str(e)}')
            return GettingChunkOutput(
                status=False,
                message=f'Failed to retrieve chunks: {str(e)}',
            )

    def _build_base_filters(
        self,
        document_id: UUID,
        include_disabled: bool,
        include_deleted: bool,
        search: Optional[str],
    ) -> list:
        """Build common query filters."""
        filters = [ChunkModel.document_id == document_id]
        if not include_deleted:
            filters.append(ChunkModel.deleted == False)  # noqa: E712
        if not include_disabled:
            filters.append(ChunkModel.is_enabled == True)  # noqa: E712
        if search and search.strip():
            term = search.strip().replace('%', '\\%').replace('_', '\\_')
            pattern = f'%{term}%'
            filters.append(or_(
                ChunkModel.content.ilike(pattern),
                func.jsonb_extract_path_text(
                    ChunkModel.chunk_metadata, 'section_heading',
                ).ilike(pattern),
            ))
        return filters

    def _get_stats(
        self, session, document_id: UUID, include_disabled: bool,
        include_deleted: bool, search: Optional[str],
    ) -> tuple[int, int, int]:
        """Get total count and enabled/disabled statistics."""
        try:
            filters = self._build_base_filters(
                document_id, include_disabled, include_deleted, search,
            )
            result = session.query(
                func.count(ChunkModel.id).label('total'),
                func.sum(
                    case((ChunkModel.is_enabled == True, 1), else_=0),  # noqa: E712
                ).label('enabled'),
            ).filter(*filters).first()

            total = result.total or 0
            enabled = int(result.enabled or 0)
            return total, enabled, total - enabled
        except Exception as e:
            logger.error(f'Error getting chunk stats: {str(e)}')
            return 0, 0, 0

    def _get_chunks(
        self, session, document_id: UUID, include_disabled: bool,
        include_deleted: bool, search: Optional[str],
        limit: int, offset: int,
    ) -> List[Chunk]:
        """Get paginated chunks with filters."""
        try:
            filters = self._build_base_filters(
                document_id, include_disabled, include_deleted, search,
            )
            results = (
                session.query(ChunkModel)
                .filter(*filters)
                .order_by(ChunkModel.chunk_index)
                .limit(limit)
                .offset(offset)
                .all()
            )

            chunks = []
            for m in results:
                try:
                    chunks.append(Chunk(
                        id=m.id, document_id=m.document_id,
                        user_id=m.user_id, chunk_index=m.chunk_index,
                        content=m.content, content_length=m.content_length,
                        qdrant_point_id=m.qdrant_point_id,
                        metadata=m.chunk_metadata, is_enabled=m.is_enabled,
                        deleted=m.deleted, created_at=m.created_at,
                        updated_at=m.updated_at,
                    ))
                except Exception as e:
                    logger.error(f'Error converting chunk {m.id}: {e}')
            return chunks
        except Exception as e:
            logger.error(f'Error getting chunks: {str(e)}')
            return []
