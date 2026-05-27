from __future__ import annotations

from uuid import UUID

from domain.db_service.chunk_services import DeletingChunkInput
from domain.db_service.chunk_services import DeletingChunkService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings

logger = get_logger(__name__)


class ChunkDeletionInput(BaseModel):
    """Input for deleting a chunk across Postgres and Qdrant."""
    chunk_id: UUID
    collection_name: str
    hard_delete: bool = False


class ChunkDeletionOutput(BaseModel):
    """Output for chunk deletion."""
    message: str


class ChunkDeletionService(BaseService):
    """Orchestrates chunk deletion across PostgreSQL and Qdrant."""

    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def qdrant_service(self) -> QdrantService:
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    @property
    def deleting_chunk_service(self) -> DeletingChunkService:
        return DeletingChunkService(settings=self.settings.postgres)

    async def process(
        self, inputs: ChunkDeletionInput, db_session=None,
    ) -> ChunkDeletionOutput:
        """Delete a chunk from both PostgreSQL and Qdrant.

        Flow:
            1. Delete in Postgres (soft or hard)
            2. Hard delete: remove from Qdrant
            3. Soft delete: update Qdrant metadata with deleted flag

        Args:
            inputs: Deletion input data.
            db_session: Optional database session.

        Returns:
            ChunkDeletionOutput with success message.

        Raises:
            Exception: If deletion fails.
        """
        delete_type = 'hard' if inputs.hard_delete else 'soft'
        try:
            logger.info(f'{delete_type.title()} deleting chunk: {inputs.chunk_id}')

            # Step 1: Delete in PostgreSQL
            pg_result = await self.deleting_chunk_service.process(
                DeletingChunkInput(
                    chunk_id=inputs.chunk_id,
                    hard_delete=inputs.hard_delete,
                ),
                db_session,
            )
            if not pg_result.status:
                raise Exception(f'PostgreSQL: {pg_result.message}')

            qdrant_point_id = (
                str(pg_result.qdrant_point_id) if pg_result.qdrant_point_id else None
            )
            logger.info(f'Chunk {delete_type} deleted in PostgreSQL')

            # Step 2: Sync with Qdrant
            if qdrant_point_id:
                if inputs.hard_delete:
                    ok = await self.qdrant_service.delete_chunk_by_point_id(
                        collection_name=inputs.collection_name,
                        qdrant_point_id=qdrant_point_id,
                    )
                    if ok:
                        logger.info(f'Chunk removed from Qdrant: {qdrant_point_id}')
                    else:
                        logger.warning('Failed to remove chunk from Qdrant')
                else:
                    ok = await self.qdrant_service.update_chunk_metadata(
                        collection_name=inputs.collection_name,
                        qdrant_point_id=qdrant_point_id,
                        metadata={'deleted': True},
                    )
                    if ok:
                        logger.info(f'Chunk marked deleted in Qdrant: {qdrant_point_id}')
                    else:
                        logger.warning('Failed to update Qdrant metadata')

            return ChunkDeletionOutput(
                message=f'Chunk {delete_type} deleted successfully',
            )

        except Exception as e:
            logger.error(f'Chunk {delete_type} deletion failed: {str(e)}')
            raise Exception(f'Chunk {delete_type} deletion failed: {str(e)}')
