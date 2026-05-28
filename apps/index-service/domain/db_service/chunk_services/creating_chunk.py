from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import ChunkController
from joint.postgres.database import DocumentController
from joint.postgres.database.schemas import Chunk
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class CreatingChunkInput(BaseModel):
    """Input for creating a new chunk."""
    document_id: UUID
    user_id: UUID
    content: str
    chunk_index: int | None = None
    metadata: dict[str, Any] | None = None
    is_enabled: bool = True


class CreatingChunkOutput(BaseModel):
    """Output after creating a chunk."""
    status: bool
    message: str
    chunk_id: UUID | None = None
    qdrant_point_id: UUID | None = None
    metadata: dict | None = None


class CreatingChunkService(BaseService):
    """Service to create a new chunk in PostgreSQL."""

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

    @property
    def document_controller(self) -> DocumentController:
        """Get document controller instance."""
        return DocumentController()

    async def process(
        self,
        input: CreatingChunkInput,
        session=None,
    ) -> CreatingChunkOutput:
        """Create a new chunk record in PostgreSQL.

        Flow:
            1. Validate document exists
            2. Calculate chunk_index if not provided
            3. Generate qdrant_point_id for future Qdrant sync
            4. Create chunk record in Postgres
            5. Return chunk data for Qdrant embedding

        Args:
            input: Chunk creation input data.
            session: Optional database session.

        Returns:
            CreatingChunkOutput with chunk_id and qdrant_point_id.
        """
        if session is not None:
            return await self._process_with_session(input, session)

        try:
            with self.postgres_db.sessionmaker() as session:
                return await self._process_with_session(input, session)
        except Exception as e:
            logger.error(f'Error creating chunk: {str(e)}')
            return CreatingChunkOutput(
                status=False,
                message=f'Failed to create chunk: {str(e)}',
            )

    async def _process_with_session(
        self,
        input: CreatingChunkInput,
        session,
    ) -> CreatingChunkOutput:
        """Internal method with provided session."""
        try:
            # Validate document exists
            document = self.document_controller.get_by_id(
                session=session, id=input.document_id,
            )
            if not document:
                return CreatingChunkOutput(
                    status=False,
                    message=f'Document not found: {input.document_id}',
                )

            # Calculate chunk_index if not provided
            chunk_index = input.chunk_index
            if chunk_index is None:
                existing = self.chunk_controller.get_by_document_id(
                    session, input.document_id,
                    include_disabled=True, include_deleted=False,
                )
                chunk_index = max(
                    [c.chunk_index for c in existing], default=-1,
                ) + 1

            # Generate IDs
            chunk_id = uuid.uuid4()
            qdrant_point_id = uuid.uuid4()

            # Build metadata
            chunk_metadata = {}
            if existing := self.chunk_controller.get_by_document_id(
                session, input.document_id,
                include_disabled=True, include_deleted=False,
            ):
                ref = next(
                    (c for c in existing if c.is_enabled and c.chunk_metadata),
                    existing[0] if existing else None,
                )
                if ref and ref.chunk_metadata:
                    for key in ('source', 'document_name', 'effective_from', 'effective_to'):
                        if key in ref.chunk_metadata:
                            chunk_metadata[key] = ref.chunk_metadata[key]

            if input.metadata:
                chunk_metadata.update(input.metadata)

            chunk_metadata.update({
                'chunk_id': str(chunk_id),
                'document_id': str(input.document_id),
                'is_enabled': input.is_enabled,
                'chunk_index': chunk_index,
                'qdrant_point_id': str(qdrant_point_id),
            })

            # Create chunk record
            chunk = Chunk(
                id=chunk_id,
                document_id=input.document_id,
                user_id=input.user_id,
                chunk_index=chunk_index,
                content=input.content,
                content_length=len(input.content),
                qdrant_point_id=qdrant_point_id,
                metadata=chunk_metadata,
                is_enabled=input.is_enabled,
                deleted=False,
            )

            self.chunk_controller.insert(session, chunk)

            logger.info(f'Created chunk {chunk_id} for document {input.document_id}')
            return CreatingChunkOutput(
                status=True,
                message='Chunk created successfully',
                chunk_id=chunk_id,
                qdrant_point_id=qdrant_point_id,
                metadata=chunk_metadata,
            )

        except Exception as e:
            session.rollback()
            logger.error(f'Failed to create chunk: {str(e)}')
            return CreatingChunkOutput(
                status=False,
                message=f'Failed to create chunk: {str(e)}',
            )
