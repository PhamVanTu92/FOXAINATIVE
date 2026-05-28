from __future__ import annotations

import uuid
from collections.abc import Sequence
from functools import partial
from typing import Any
from typing import cast

from sqlalchemy import and_
from sqlalchemy.orm import Session
from structlog.stdlib import get_logger

from ...models import Chunk as ChunkModel
from ..repository import Repository
from ..schemas import Chunk
from ..utils import _delete
from ..utils import _get_data
from ..utils import _get_data_by_id
from ..utils import _insert
from ..utils import _update

logger = get_logger(__name__)

_insert_method = partial(_insert, logger, ChunkModel, Chunk)
_update_method = partial(_update, logger, ChunkModel, Chunk)
_delete_method = partial(_delete, logger, ChunkModel, Chunk)
_get_method = partial(_get_data, logger, ChunkModel, Chunk)
_get_by_id_method = partial(_get_data_by_id, logger, ChunkModel, Chunk)


class ChunkController(Repository):
    """Controller for Chunk database operations."""

    def insert(self, session: Session, model: Chunk) -> Chunk:
        return cast(Chunk, _insert_method(session, model))

    def update(self, session: Session, model: Chunk) -> Chunk | None:
        result = _update_method(session, model)
        return cast(Chunk, result) if result else None

    def delete(self, session: Session, id: uuid.UUID) -> Chunk | None:
        result = _delete_method(session, id)
        return cast(Chunk, result) if result else None

    def get_by_id(self, session: Session, id: uuid.UUID) -> Chunk | None:
        result = _get_by_id_method(session, id)
        return cast(Chunk, result) if result else None

    def get_all(
        self,
        session: Session,
        filter: dict[str, object] | None = None,
        order_by: Sequence | None = None,
        limit: int | None = None,
    ) -> list[Chunk] | None:
        result = _get_method(session, filter, order_by, limit)
        return cast(list[Chunk], result) if result else None

    def get_by_document_id(
        self,
        session: Session,
        document_id: uuid.UUID,
        include_disabled: bool = False,
        include_deleted: bool = False,
    ) -> list[ChunkModel]:
        """Get all chunks for a document with optional filtering.

        Args:
            session: Database session.
            document_id: ID of the parent document.
            include_disabled: If True, include disabled chunks.
            include_deleted: If True, include soft-deleted chunks.

        Returns:
            List of chunk model instances.
        """
        query = session.query(ChunkModel).filter(
            ChunkModel.document_id == document_id,
        )
        if not include_deleted:
            query = query.filter(ChunkModel.deleted == False)  # noqa: E712
        if not include_disabled:
            query = query.filter(ChunkModel.is_enabled == True)  # noqa: E712
        return query.order_by(ChunkModel.chunk_index).all()

    def bulk_insert(self, session: Session, chunks: list[Chunk]) -> list[ChunkModel]:
        """Batch insert multiple chunks efficiently.

        Args:
            session: Database session.
            chunks: List of Chunk schemas to insert.

        Returns:
            List of inserted chunk model instances.
        """
        objects = [
            ChunkModel(**chunk.model_dump(exclude_none=True, by_alias=False))
            for chunk in chunks
        ]
        session.add_all(objects)
        session.flush()
        return objects

    def soft_delete(self, session: Session, chunk_id: uuid.UUID) -> bool:
        """Mark a chunk as deleted (soft delete).

        Args:
            session: Database session.
            chunk_id: ID of the chunk to soft-delete.

        Returns:
            True if successful, False if chunk not found.
        """
        obj = session.get(ChunkModel, chunk_id)
        if not obj:
            return False
        obj.deleted = True
        obj.is_enabled = False
        session.flush()
        return True

    def hard_delete(self, session: Session, chunk_id: uuid.UUID) -> bool:
        """Permanently delete a chunk from the database.

        Args:
            session: Database session.
            chunk_id: ID of the chunk to delete.

        Returns:
            True if successful, False if chunk not found.
        """
        obj = session.get(ChunkModel, chunk_id)
        if not obj:
            return False
        session.delete(obj)
        session.flush()
        return True

    def enable(self, session: Session, chunk_id: uuid.UUID, is_enabled: bool) -> bool:
        """Toggle chunk enabled/disabled status.

        Args:
            session: Database session.
            chunk_id: ID of the chunk.
            is_enabled: Target enabled state.

        Returns:
            True if successful, False if chunk not found.
        """
        obj = session.get(ChunkModel, chunk_id)
        if not obj:
            return False
        obj.is_enabled = is_enabled
        session.flush()
        return True

    def update_by_id(
        self,
        session: Session,
        id: uuid.UUID,
        update_data: dict[str, Any],
    ) -> ChunkModel | None:
        """Partial update a chunk by ID.

        Args:
            session: Database session.
            id: Chunk ID.
            update_data: Dictionary of fields to update.

        Returns:
            Updated chunk model or None if not found.
        """
        obj = session.get(ChunkModel, id)
        if not obj:
            return None
        for key, value in update_data.items():
            setattr(obj, key, value)
        session.flush()
        return obj
