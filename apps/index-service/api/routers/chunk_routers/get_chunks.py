from __future__ import annotations

from typing import Optional
from uuid import UUID

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ChunkResponseSamples
from domain.db_service.chunk_services import GettingChunkInput
from domain.db_service.chunk_services import GettingChunkOutput
from domain.db_service.chunk_services import GettingChunkService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


@router.get(
    '/documents/{document_id}/chunks',
    response_model=GettingChunkOutput,
    responses=ChunkResponseSamples.get_chunks_responses(),
    status_code=status.HTTP_200_OK,
    summary='Get paginated chunks for a document',
    description="""Retrieve paginated list of chunks for a specific document with optional search.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- document_id: UUID of the document

Query Parameters:
- page: Page number (integer, min 1, default 1)
- page_size: Items per page (integer, min 1, max 100, default 10)
- include_disabled: Include disabled chunks (default: false)
- search: Search term for filtering by content or section heading

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "chunks": [...],
    "total": 15,
    "enabled": 14,
    "disabled": 1,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

Business Rules:
- Returns chunks ordered by chunk_index
- Disabled chunks are excluded unless include_disabled=true
- Soft-deleted chunks are always excluded
- Search performs case-insensitive partial match on content and section_heading

Common Errors:
- 400: Invalid page or page_size values
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 404: Document not found

Integration Notes:
- Implement pagination UI using total_pages field
- Use search parameter for chunk filtering
- Track enabled/disabled counts for toggle UI""",
)
async def get_chunks(
    document_id: UUID,
    page: int = Query(1, ge=1, description='Page number (starting from 1)'),
    page_size: int = Query(
        10, ge=1, le=100, description='Number of items per page (1-100)',
    ),
    include_disabled: bool = Query(
        False, description='Include disabled chunks in results',
    ),
    search: Optional[str] = Query(
        None, description='Search term to filter chunks by content or section heading',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> GettingChunkOutput:
    """
    Get paginated chunks for a document.

    This endpoint retrieves chunks:
    - User authentication is required (JWT token)
    - Document ID is specified in the URL path
    - Pagination and filtering parameters are validated
    - Chunks are ordered by chunk_index

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)

    **Parameters**:
    - **document_id**: UUID of the parent document
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 10, max: 100)
    - **include_disabled**: Include disabled chunks (default: false)
    - **search**: Search term for content or section heading filtering

    Returns paginated chunk data with statistics.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        # Validate page parameters
        if page < 1:
            return exception_handler.handle_bad_request(
                message='Page number must be greater than 0',
                extra={
                    'endpoint': 'get_chunks',
                    'page': page,
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        if page_size < 1 or page_size > 100:
            return exception_handler.handle_bad_request(
                message='Page size must be between 1 and 100',
                extra={
                    'endpoint': 'get_chunks',
                    'page_size': page_size,
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        getting_service = GettingChunkService(settings=settings.postgres)

        logger.info(
            f'Getting chunks - document_id={document_id}, page={page}, '
            f'page_size={page_size}, search={search}, '
            f'by user: {current_user.user_id}',
        )

        result = await getting_service.process(
            GettingChunkInput(
                document_id=document_id,
                page=page,
                page_size=page_size,
                include_disabled=include_disabled,
                search=search,
            ),
            db,
        )

        if not result.status:
            return exception_handler.handle_bad_request(
                message=result.message,
                extra={
                    'endpoint': 'get_chunks',
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Chunks retrieved successfully - document_id={document_id}, '
            f'total={result.data.total if result.data else 0}',
        )
        return exception_handler.handle_success(
            output=result.data.model_dump() if result.data else {},
        )

    except ValueError as e:
        logger.error(f'Invalid parameter format: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid parameter format: {str(e)}',
            extra={
                'endpoint': 'get_chunks',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
            },
        )
    except Exception as e:
        logger.error(
            f'Failed to get chunks for document {document_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve chunks: {str(e)}',
            extra={
                'endpoint': 'get_chunks',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
