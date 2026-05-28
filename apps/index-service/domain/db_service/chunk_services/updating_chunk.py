from __future__ import annotations

from typing import Any
from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ChunkController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class UpdatingChunkInput(BaseModel):
    """Input for updating a chunk."""
    chunk_id: UUID
    content: str | None = None
    metadata: dict[str, Any] | None = None
    is_enabled: bool | None = None


class UpdatingChunkOutput(BaseModel):
    """Output after updating a chunk."""
    status: bool
    message: str
    content: str | None = None
    metadata: dict | None = None


class UpdatingChunkService(BaseService):
    """Service to update an existing chunk in PostgreSQL."""

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
        self,
        input: UpdatingChunkInput,
        session=None,
    ) -> UpdatingChunkOutput:
        """Update an existing chunk in PostgreSQL.

        Flow:
            1. Get existing chunk and validate
            2. Update fields if provided
            3. Merge metadata preserving sync IDs
            4. Return updated data for Qdrant sync

        Args:
            input: Update input data.
            session: Optional database session.

        Returns:
            UpdatingChunkOutput with updated content and metadata.
        """
        if session is not None:
            return await self._process_with_session(input, session)

        try:
            with self.postgres_db.sessionmaker() as session:
                return await self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error updating chunk {input.chunk_id}: {str(e)}')
            return UpdatingChunkOutput(
                status=False,
                message=f'Failed to update chunk: {str(e)}',
            )

    async def _process_with_session(
        self, input: UpdatingChunkInput, session,
    ) -> UpdatingChunkOutput:
        """Internal method with provided session."""
        try:
            existing = self.chunk_controller.get_by_id(
                session=session, id=input.chunk_id,
            )
            if not existing:
                return UpdatingChunkOutput(
                    status=False,
                    message=f'Chunk not found: {input.chunk_id}',
                )
            if existing.deleted:
                return UpdatingChunkOutput(
                    status=False, message='Cannot update deleted chunk',
                )

            update_data: dict[str, Any] = {}

            if input.content is not None:
                update_data['content'] = input.content
                update_data['content_length'] = len(input.content)

            if input.is_enabled is not None:
                update_data['is_enabled'] = input.is_enabled

            if input.metadata is not None:
                merged = (existing.chunk_metadata or {}).copy()
                merged.update(input.metadata)
                # Preserve sync IDs
                merged.update({
                    'chunk_id': str(existing.id),
                    'document_id': str(existing.document_id),
                    'is_enabled': update_data.get('is_enabled', existing.is_enabled),
                    'qdrant_point_id': str(existing.qdrant_point_id),
                })
                update_data['chunk_metadata'] = merged

            updated = self.chunk_controller.update_by_id(
                session=session, id=input.chunk_id, update_data=update_data,
            )
            if not updated:
                return UpdatingChunkOutput(
                    status=False, message='Failed to update chunk',
                )

            content = updated.content
            metadata = updated.chunk_metadata
            session.commit()

            logger.info(f'Updated chunk: {input.chunk_id}')
            return UpdatingChunkOutput(
                status=True, message='Chunk updated successfully',
                content=content, metadata=metadata,
            )

        except Exception as e:
            session.rollback()
            logger.error(f'Failed to update chunk: {str(e)}')
            return UpdatingChunkOutput(
                status=False, message=f'Failed to update chunk: {str(e)}',
            )
