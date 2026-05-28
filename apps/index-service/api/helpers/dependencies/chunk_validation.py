"""Chunk validation dependencies for FastAPI endpoints."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from fastapi import status
from joint.logging import get_logger
from joint.postgres.database import ChunkController
from joint.postgres.database import CollectionController
from joint.postgres.database import DocumentController
from sqlalchemy.orm import Session

logger = get_logger(__name__)


def get_collection_name_by_chunk_id(
    chunk_id: uuid.UUID,
    db: Session,
) -> str:
    """Get collection_name from chunk_id by traversing chunk → document → collection.

    Args:
        chunk_id: UUID of the chunk.
        db: Database session.

    Returns:
        The collection_name.

    Raises:
        HTTPException: If chunk, document, or collection not found.
    """
    try:
        if not chunk_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Chunk ID is required',
            )

        chunk_controller = ChunkController()
        chunk = chunk_controller.get_by_id(session=db, id=chunk_id)
        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chunk with ID '{chunk_id}' not found",
            )

        document_controller = DocumentController()
        document = document_controller.get_by_id(session=db, id=chunk.document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document not found for chunk '{chunk_id}'",
            )

        collection_controller = CollectionController()
        collection = collection_controller.get_by_id(
            session=db, id=document.collection_id,
        )
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection not found for chunk '{chunk_id}'",
            )

        return collection.collection_name

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting collection for chunk {chunk_id}: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to get collection for chunk: {str(e)}',
        )
