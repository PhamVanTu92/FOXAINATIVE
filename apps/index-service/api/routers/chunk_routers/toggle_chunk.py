from __future__ import annotations

from uuid import UUID

from api.helpers.dependencies.chunk_validation import get_collection_name_by_chunk_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ChunkResponseSamples
from app.chunks import ChunkTogglingInput
from app.chunks import ChunkTogglingOutput
from app.chunks import ChunkTogglingService
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


class ToggleChunkRequest(BaseModel):
    """Request body for toggling chunk status."""
    is_enabled: bool


@router.patch(
    '/{chunk_id}/toggle',
    response_model=ChunkTogglingOutput,
    responses=ChunkResponseSamples.toggle_chunk_responses(),
    status_code=status.HTTP_200_OK,
    summary='Toggle chunk enabled/disabled status',
    description="""Enable or disable a chunk with Qdrant metadata sync.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- chunk_id: UUID of the chunk to toggle

Request Body:
```json
{
  "is_enabled": false
}
```

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Chunk disabled successfully"
  }
}
```

Business Rules:
- Disabled chunks are excluded from search results
- Toggle is idempotent (toggling to same state returns success)
- Deleted chunks cannot be toggled
- Qdrant metadata is updated with new is_enabled state

Common Errors:
- 400: Invalid request body
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 404: Chunk not found

Integration Notes:
- Use to temporarily hide chunks from search without deleting
- Toggling is near-instant (no re-embedding needed)
- UI should reflect enabled/disabled state immediately""",
)
async def toggle_chunk(
    chunk_id: UUID,
    body: ToggleChunkRequest = Body(...),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> ChunkTogglingOutput:
    """
    Toggle chunk enabled/disabled status with Qdrant sync.

    This endpoint toggles chunks:
    - User authentication is required (JWT token)
    - Chunk ID is specified in the URL path
    - Updates is_enabled in PostgreSQL and Qdrant metadata

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)

    **Process Flow**:
    1. Validate chunk exists and is not deleted
    2. Toggle is_enabled in PostgreSQL
    3. Update Qdrant metadata with new state
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
        service = ChunkTogglingService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        action = 'Enabling' if body.is_enabled else 'Disabling'
        logger.info(
            f'{action} chunk: {chunk_id} by user: {current_user.user_id}',
        )

        # Call the chunk toggling service
        result = await service.process(
            ChunkTogglingInput(
                chunk_id=chunk_id,
                collection_name=collection_name,
                is_enabled=body.is_enabled,
            ),
            db,
        )

        logger.info(f'Chunk toggle completed for: {chunk_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid input for chunk toggle: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid input: {str(e)}',
            extra={
                'endpoint': 'toggle_chunk',
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
                    'endpoint': 'toggle_chunk',
                    'chunk_id': str(chunk_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(f'Failed to toggle chunk {chunk_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Chunk toggle failed: {str(e)}',
            extra={
                'endpoint': 'toggle_chunk',
                'chunk_id': str(chunk_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
