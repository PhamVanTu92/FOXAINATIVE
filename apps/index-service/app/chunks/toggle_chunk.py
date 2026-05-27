from __future__ import annotations

from uuid import UUID

from domain.db_service.chunk_services import TogglingChunkInput
from domain.db_service.chunk_services import TogglingChunkService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings

logger = get_logger(__name__)


class ChunkTogglingInput(BaseModel):
    """Input for toggling chunk status across Postgres and Qdrant."""
    chunk_id: UUID
    collection_name: str
    is_enabled: bool


class ChunkTogglingOutput(BaseModel):
    """Output for chunk toggling."""
    message: str


class ChunkTogglingService(BaseService):
    """Orchestrates chunk enable/disable across PostgreSQL and Qdrant."""

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
    def toggling_chunk_service(self) -> TogglingChunkService:
        return TogglingChunkService(settings=self.settings.postgres)

    async def process(
        self, inputs: ChunkTogglingInput, db_session=None,
    ) -> ChunkTogglingOutput:
        """Toggle chunk enabled status in both PostgreSQL and Qdrant.

        Flow:
            1. Toggle is_enabled in Postgres
            2. Update Qdrant metadata with new state

        Args:
            inputs: Toggle input data.
            db_session: Optional database session.

        Returns:
            ChunkTogglingOutput with success message.

        Raises:
            Exception: If toggle fails.
        """
        action = 'enabling' if inputs.is_enabled else 'disabling'
        try:
            logger.info(f'{action.title()} chunk: {inputs.chunk_id}')

            # Step 1: Toggle in PostgreSQL
            pg_result = await self.toggling_chunk_service.process(
                TogglingChunkInput(
                    chunk_id=inputs.chunk_id,
                    is_enabled=inputs.is_enabled,
                ),
                db_session,
            )
            if not pg_result.status:
                raise Exception(f'PostgreSQL: {pg_result.message}')

            logger.info(f'Chunk toggled in PostgreSQL: {inputs.chunk_id}')

            # Step 2: Update Qdrant metadata
            qdrant_point_id = str(pg_result.qdrant_point_id)
            metadata = pg_result.metadata or {}

            ok = await self.qdrant_service.update_chunk_metadata(
                collection_name=inputs.collection_name,
                qdrant_point_id=qdrant_point_id,
                metadata=metadata,
            )
            if ok:
                logger.info(f'Qdrant metadata updated: {qdrant_point_id}')
            else:
                logger.warning('Failed to update Qdrant metadata')

            past = 'enabled' if inputs.is_enabled else 'disabled'
            return ChunkTogglingOutput(message=f'Chunk {past} successfully')

        except Exception as e:
            logger.error(f'Chunk toggle failed: {str(e)}')
            raise Exception(f'Chunk toggle failed: {str(e)}')
