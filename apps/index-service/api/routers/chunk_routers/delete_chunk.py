from __future__ import annotations

from uuid import UUID

from api.helpers.dependencies.chunk_validation import get_collection_name_by_chunk_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ChunkResponseSamples
from app.chunks import ChunkDeletionInput
from app.chunks import ChunkDeletionOutput
from app.chunks import ChunkDeletionService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


@router.delete(
    '/{chunk_id}',
    response_model=ChunkDeletionOutput,
    responses=ChunkResponseSamples.delete_chunk_responses(),
    status_code=status.HTTP_200_OK,
    summary='Delete a chunk',
    description="""Delete a chunk from PostgreSQL and Qdrant.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- chunk_id: UUID of the chunk to delete

Query Parameters:
- hard_delete: If true, permanently removes chunk. If false, soft deletes (default: false)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Chunk soft deleted successfully"
  }
}
```

Business Rules:
- Soft delete: Sets deleted=true and is_enabled=false in PostgreSQL, updates Qdrant metadata
- Hard delete: Permanently removes from PostgreSQL and Qdrant
- Soft-deleted chunks are excluded from all queries
- Hard delete is irreversible

Common Errors:
- 400: Invalid UUID format for chunk_id
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 404: Chunk not found

Integration Notes:
- Show confirmation dialog before hard deletion
- Default to soft delete for safety
- Remove chunk from local cache after successful deletion
- Handle 404 gracefully if chunk already deleted""",
)
async def delete_chunk(
    chunk_id: UUID,
    hard_delete: bool = Query(
        False, description='If true, permanently removes chunk (irreversible)',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> ChunkDeletionOutput:
    """
    Delete a chunk from both PostgreSQL and Qdrant.

    This endpoint deletes chunks:
    - User authentication is required (JWT token)
    - Chunk ID is specified in the URL path
    - Supports both soft delete (default) and hard delete
    - Uses default embedding provider for Qdrant operations

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)

    **Process Flow**:
    1. Validate chunk exists
    2. Delete in PostgreSQL (soft or hard)
    3. Sync with Qdrant (update metadata or remove point)
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
        service = ChunkDeletionService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        delete_type = 'hard' if hard_delete else 'soft'
        logger.info(
            f'{delete_type.title()} deleting chunk: {chunk_id} '
            f'by user: {current_user.user_id}',
        )

        # Call the chunk deletion service
        result = await service.process(
            ChunkDeletionInput(
                chunk_id=chunk_id,
                collection_name=collection_name,
                hard_delete=hard_delete,
            ),
            db,
        )

        logger.info(f'Chunk {delete_type} deletion completed for: {chunk_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid chunk ID format {chunk_id}: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid chunk ID format: {str(e)}',
            extra={
                'endpoint': 'delete_chunk',
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
                    'endpoint': 'delete_chunk',
                    'chunk_id': str(chunk_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(f'Failed to delete chunk {chunk_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Chunk deletion failed: {str(e)}',
            extra={
                'endpoint': 'delete_chunk',
                'chunk_id': str(chunk_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
