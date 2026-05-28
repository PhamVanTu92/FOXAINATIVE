from __future__ import annotations

from typing import Any
from uuid import UUID

from domain.db_service.chunk_services import CreatingChunkInput
from domain.db_service.chunk_services import CreatingChunkService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings

logger = get_logger(__name__)


class ChunkCreationInput(BaseModel):
    """Input for creating a chunk across Postgres and Qdrant."""
    document_id: UUID
    collection_name: str
    user_id: UUID
    content: str
    chunk_index: int | None = None
    metadata: dict[str, Any] | None = None
    is_enabled: bool = True


class ChunkCreationOutput(BaseModel):
    """Output for chunk creation."""
    message: str
    chunk_id: UUID


class ChunkCreationService(BaseService):
    """Orchestrates chunk creation across PostgreSQL and Qdrant."""

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
    def creating_chunk_service(self) -> CreatingChunkService:
        return CreatingChunkService(settings=self.settings.postgres)

    async def process(
        self, inputs: ChunkCreationInput, db_session=None,
    ) -> ChunkCreationOutput:
        """Create a chunk in both PostgreSQL and Qdrant.

        Flow:
            1. Create chunk in Postgres (generates chunk_id, qdrant_point_id)
            2. Upsert chunk to Qdrant with embedding
            3. Return chunk_id

        Args:
            inputs: Chunk creation data.
            db_session: Optional database session.

        Returns:
            ChunkCreationOutput with chunk_id.

        Raises:
            Exception: If creation fails in either system.
        """
        try:
            logger.info(f'Creating chunk for document: {inputs.document_id}')

            # Step 1: Create in PostgreSQL
            pg_result = await self.creating_chunk_service.process(
                CreatingChunkInput(
                    document_id=inputs.document_id,
                    user_id=inputs.user_id,
                    content=inputs.content,
                    chunk_index=inputs.chunk_index,
                    metadata=inputs.metadata,
                    is_enabled=inputs.is_enabled,
                ),
                db_session,
            )
            if not pg_result.status:
                raise Exception(f'PostgreSQL: {pg_result.message}')

            logger.info(f'Chunk created in PostgreSQL: {pg_result.chunk_id}')

            # Step 2: Upsert to Qdrant
            qdrant_ok = await self.qdrant_service.upsert_chunk(
                collection_name=inputs.collection_name,
                chunk_content=inputs.content,
                qdrant_point_id=str(pg_result.qdrant_point_id),
                metadata=pg_result.metadata or {},
            )
            if qdrant_ok:
                logger.info(f'Chunk upserted to Qdrant: {pg_result.qdrant_point_id}')
            else:
                logger.warning('Failed to upsert chunk to Qdrant')

            return ChunkCreationOutput(
                message='Chunk created successfully',
                chunk_id=pg_result.chunk_id,
            )

        except Exception as e:
            logger.error(f'Chunk creation failed: {str(e)}')
            raise Exception(f'Chunk creation failed: {str(e)}')
