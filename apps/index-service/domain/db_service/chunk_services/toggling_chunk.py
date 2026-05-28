from __future__ import annotations

from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ChunkController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class TogglingChunkInput(BaseModel):
    """Input for toggling chunk enabled status."""
    chunk_id: UUID
    is_enabled: bool


class TogglingChunkOutput(BaseModel):
    """Output after toggling a chunk."""
    status: bool
    message: str
    qdrant_point_id: UUID | None = None
    metadata: dict | None = None


class TogglingChunkService(BaseService):
    """Service to toggle chunk enabled/disabled status in PostgreSQL."""

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
        input: TogglingChunkInput,
        session=None,
    ) -> TogglingChunkOutput:
        """Toggle chunk enabled/disabled status.

        Args:
            input: Toggle input with chunk_id and target state.
            session: Optional database session.

        Returns:
            TogglingChunkOutput with qdrant_point_id and metadata for Qdrant sync.
        """
        if session is not None:
            return await self._process_with_session(input, session)

        try:
            with self.postgres_db.sessionmaker() as session:
                return await self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error toggling chunk {input.chunk_id}: {str(e)}')
            return TogglingChunkOutput(
                status=False,
                message=f'Failed to toggle chunk: {str(e)}',
            )

    async def _process_with_session(
        self, input: TogglingChunkInput, session,
    ) -> TogglingChunkOutput:
        """Internal method with provided session."""
        try:
            existing = self.chunk_controller.get_by_id(
                session=session, id=input.chunk_id,
            )
            if not existing:
                return TogglingChunkOutput(
                    status=False,
                    message=f'Chunk not found: {input.chunk_id}',
                )
            if existing.deleted:
                return TogglingChunkOutput(
                    status=False, message='Cannot toggle deleted chunk',
                )
            if existing.is_enabled == input.is_enabled:
                action = 'enabled' if input.is_enabled else 'disabled'
                return TogglingChunkOutput(
                    status=True, message=f'Chunk already {action}',
                    qdrant_point_id=existing.qdrant_point_id,
                    metadata=existing.chunk_metadata,
                )

            success = self.chunk_controller.enable(
                session, input.chunk_id, input.is_enabled,
            )
            if not success:
                return TogglingChunkOutput(
                    status=False, message='Failed to toggle chunk',
                )

            # Read updated data before commit
            updated = self.chunk_controller.get_by_id(
                session=session, id=input.chunk_id,
            )
            if not updated:
                return TogglingChunkOutput(
                    status=False, message='Chunk not found after toggle',
                )

            qdrant_point_id = updated.qdrant_point_id
            metadata = updated.chunk_metadata
            session.commit()

            action = 'enabled' if input.is_enabled else 'disabled'
            logger.info(f'Chunk {action}: {input.chunk_id}')

            return TogglingChunkOutput(
                status=True, message=f'Chunk {action} successfully',
                qdrant_point_id=qdrant_point_id, metadata=metadata,
            )

        except Exception as e:
            session.rollback()
            logger.error(f'Failed to toggle chunk: {str(e)}')
            return TogglingChunkOutput(
                status=False, message=f'Failed to toggle chunk: {str(e)}',
            )
