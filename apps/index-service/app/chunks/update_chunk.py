from __future__ import annotations

from typing import Any
from uuid import UUID

from domain.db_service.chunk_services import UpdatingChunkInput
from domain.db_service.chunk_services import UpdatingChunkService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres.database import ChunkController
from joint.settings import Settings

logger = get_logger(__name__)


class ChunkUpdatingInput(BaseModel):
    """Input for updating a chunk across Postgres and Qdrant."""
    chunk_id: UUID
    collection_name: str
    content: str | None = None
    metadata: dict[str, Any] | None = None
    is_enabled: bool | None = None


class ChunkUpdatingOutput(BaseModel):
    """Output for chunk update."""
    message: str


class ChunkUpdatingService(BaseService):
    """Orchestrates chunk update across PostgreSQL and Qdrant."""

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
    def updating_chunk_service(self) -> UpdatingChunkService:
        return UpdatingChunkService(settings=self.settings.postgres)

    async def process(
        self, inputs: ChunkUpdatingInput, db_session=None,
    ) -> ChunkUpdatingOutput:
        """Update a chunk in both PostgreSQL and Qdrant.

        Flow:
            1. Get existing chunk to detect content changes
            2. Update in Postgres
            3. If content changed: re-embed and upsert to Qdrant
            4. If only metadata changed: update Qdrant payload only

        Args:
            inputs: Chunk update data.
            db_session: Optional database session.

        Returns:
            ChunkUpdatingOutput with success message.

        Raises:
            Exception: If update fails.
        """
        try:
            logger.info(f'Updating chunk: {inputs.chunk_id}')

            # Get existing chunk for change detection
            chunk_controller = ChunkController()
            existing = chunk_controller.get_by_id(
                session=db_session, id=inputs.chunk_id,
            )
            if not existing:
                raise Exception(f'Chunk {inputs.chunk_id} not found')

            qdrant_point_id = str(existing.qdrant_point_id)
            old_content = existing.content

            # Step 1: Update in PostgreSQL
            pg_result = await self.updating_chunk_service.process(
                UpdatingChunkInput(
                    chunk_id=inputs.chunk_id,
                    content=inputs.content,
                    metadata=inputs.metadata,
                    is_enabled=inputs.is_enabled,
                ),
                db_session,
            )
            if not pg_result.status:
                raise Exception(f'PostgreSQL: {pg_result.message}')

            logger.info(f'Chunk updated in PostgreSQL: {inputs.chunk_id}')

            # Step 2: Sync with Qdrant
            content_changed = (
                inputs.content is not None and inputs.content != old_content
            )
            metadata = pg_result.metadata or {}

            if content_changed:
                logger.info(f'Content changed, re-embedding chunk {inputs.chunk_id}')
                await self.qdrant_service.upsert_chunk(
                    collection_name=inputs.collection_name,
                    chunk_content=pg_result.content,
                    qdrant_point_id=qdrant_point_id,
                    metadata=metadata,
                )
            else:
                logger.info(f'Metadata only, updating Qdrant payload')
                await self.qdrant_service.update_chunk_metadata(
                    collection_name=inputs.collection_name,
                    qdrant_point_id=qdrant_point_id,
                    metadata=metadata,
                )

            return ChunkUpdatingOutput(message='Chunk updated successfully')

        except Exception as e:
            logger.error(f'Chunk update failed: {str(e)}')
            raise Exception(f'Chunk update failed: {str(e)}')
