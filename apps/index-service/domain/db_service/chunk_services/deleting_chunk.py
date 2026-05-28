from __future__ import annotations

from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ChunkController
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class DeletingChunkInput(BaseModel):
    """Input for deleting a chunk."""
    chunk_id: UUID
    hard_delete: bool = False


class DeletingChunkOutput(BaseModel):
    """Output after deleting a chunk."""
    status: bool
    message: str
    qdrant_point_id: UUID | None = None


class DeletingChunkService(BaseService):
    """Service to delete a chunk (soft or hard) from PostgreSQL."""

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
        input: DeletingChunkInput,
        session=None,
    ) -> DeletingChunkOutput:
        """Delete a chunk from PostgreSQL (soft or hard).

        Args:
            input: Deletion input with chunk_id and delete type.
            session: Optional database session.

        Returns:
            DeletingChunkOutput with qdrant_point_id for Qdrant cleanup.
        """
        if session is not None:
            return await self._process_with_session(input, session)

        try:
            with self.postgres_db.sessionmaker() as session:
                return await self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error deleting chunk {input.chunk_id}: {str(e)}')
            return DeletingChunkOutput(
                status=False,
                message=f'Failed to delete chunk: {str(e)}',
            )

    async def _process_with_session(
        self, input: DeletingChunkInput, session,
    ) -> DeletingChunkOutput:
        """Internal method with provided session."""
        try:
            existing = self.chunk_controller.get_by_id(
                session=session, id=input.chunk_id,
            )
            if not existing:
                return DeletingChunkOutput(
                    status=False,
                    message=f'Chunk not found: {input.chunk_id}',
                )

            qdrant_point_id = existing.qdrant_point_id

            if input.hard_delete:
                success = self.chunk_controller.hard_delete(session, input.chunk_id)
                action = 'hard deleted'
            else:
                success = self.chunk_controller.soft_delete(session, input.chunk_id)
                action = 'soft deleted'

            if not success:
                return DeletingChunkOutput(
                    status=False, message=f'Failed to {action} chunk',
                )

            session.commit()
            logger.info(f'Chunk {action}: {input.chunk_id}')

            return DeletingChunkOutput(
                status=True,
                message=f'Chunk {action} successfully',
                qdrant_point_id=qdrant_point_id,
            )

        except Exception as e:
            session.rollback()
            logger.error(f'Failed to delete chunk: {str(e)}')
            return DeletingChunkOutput(
                status=False, message=f'Failed to delete chunk: {str(e)}',
            )
