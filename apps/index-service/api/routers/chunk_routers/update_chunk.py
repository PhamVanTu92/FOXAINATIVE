from __future__ import annotations

from typing import Any
from typing import Optional
from uuid import UUID

from api.helpers.dependencies.chunk_validation import get_collection_name_by_chunk_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ChunkResponseSamples
from app.chunks import ChunkUpdatingInput
from app.chunks import ChunkUpdatingOutput
from app.chunks import ChunkUpdatingService
from fastapi import APIRouter
from fastapi import Body
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.utils import get_settings
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


class UpdateChunkRequest(BaseModel):
    """Request body for updating a chunk."""
    content: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    is_enabled: Optional[bool] = None


@router.put(
    '/{chunk_id}',
    response_model=ChunkUpdatingOutput,
    responses=ChunkResponseSamples.update_chunk_responses(),
    status_code=status.HTTP_200_OK,
    summary='Update a chunk',
    description="""Update chunk content, metadata, or enabled status with Qdrant sync.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- chunk_id: UUID of the chunk to update

Request Body (all optional):
```json
{
  "content": "Updated chunk text",
  "metadata": {"key": "value"},
  "is_enabled": true
}
```

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Chunk updated successfully"
  }
}
```

Business Rules:
- If content changes, chunk is re-embedded in Qdrant (new vector)
- If only metadata changes, only Qdrant payload is updated (no re-embed)
- Deleted chunks cannot be updated
- Metadata merge preserves sync IDs (chunk_id, document_id, qdrant_point_id)

Common Errors:
- 400: Invalid input format
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 404: Chunk not found

Integration Notes:
- Content changes trigger re-embedding (may take longer)
- Metadata-only updates are near-instant
- Cannot update soft-deleted chunks""",
)
async def update_chunk(
    chunk_id: UUID,
    body: UpdateChunkRequest = Body(...),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> ChunkUpdatingOutput:
    """
    Update an existing chunk with Qdrant sync.

    This endpoint updates chunks:
    - User authentication is required (JWT token)
    - Chunk ID is specified in the URL path
    - Detects content vs metadata-only changes for optimal Qdrant sync
    - Uses default embedding provider for re-embedding

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)

    **Process Flow**:
    1. Validate chunk exists and is not deleted
    2. Update chunk in PostgreSQL
    3. If content changed: re-embed and upsert to Qdrant
    4. If metadata only: update Qdrant payload
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        # Get collection_name from chunk_id
        collection_name = get_collection_name_by_chunk_id(
            chunk_id=chunk_id, db=db,
        )

        # Initialize service with default providers
        service = ChunkUpdatingService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        logger.info(
            f'Updating chunk: {chunk_id} by user: {current_user.user_id}',
        )

        # Call the chunk updating service
        result = await service.process(
            ChunkUpdatingInput(
                chunk_id=chunk_id,
                collection_name=collection_name,
                content=body.content,
                metadata=body.metadata,
                is_enabled=body.is_enabled,
            ),
            db,
        )

        logger.info(f'Chunk update completed for: {chunk_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid input for chunk update: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid input: {str(e)}',
            extra={
                'endpoint': 'update_chunk',
                'chunk_id': str(chunk_id),
                'user_id': str(current_user.user_id),
            },
        )
    except Exception as e:
        error_msg = str(e).lower()

        # Check if it's a "not found" error
        if 'not found' in error_msg or 'does not exist' in error_msg:
            logger.warning(f'Chunk {chunk_id} not found: {str(e)}')
            return exception_handler.handle_not_found_error(
                message=f'Chunk with ID {chunk_id} not found',
                extra={
                    'endpoint': 'update_chunk',
                    'chunk_id': str(chunk_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(f'Failed to update chunk {chunk_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Chunk update failed: {str(e)}',
            extra={
                'endpoint': 'update_chunk',
                'chunk_id': str(chunk_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
