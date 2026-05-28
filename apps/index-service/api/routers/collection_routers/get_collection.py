from __future__ import annotations

from typing import Optional

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import CollectionResponseSamples
from app.colllections import CollectionGettingInput
from app.colllections import CollectionGettingService
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

# No more manual SecurityDependencies initialization needed!

try:
    collection_getting_service = CollectionGettingService(
        postgres_settings=settings.postgres,
    )
    logger.info('Collection getting service initialized successfully')
except Exception as e:
    logger.error(f"Failed to initialize collection getting service: {str(e)}")
    raise RuntimeError(
        f"Collection getting service initialization failed: {str(e)}",
    )


@router.get(
    '/collections',
    responses=CollectionResponseSamples.get_collection_responses(),
    status_code=status.HTTP_200_OK,
    summary='Get collections for authenticated user',
    description="""Retrieve paginated list of collections with optional search filtering.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Query Parameters:
- page: Page number (integer, min 1, default 1)
- page_size: Items per page (integer, min 1, max 100, default 10)
- search: Search term for filtering by name or description (optional)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "data": {
      "items": [
        {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "collection_name": "company_policies",
          "description": "Internal company policy documents",
          "user_id": "user-uuid",
          "created_at": "2026-02-02T10:30:00+07:00",
          "updated_at": "2026-02-02T10:30:00+07:00"
        }
      ],
      "total": 25,
      "page": 1,
      "page_size": 10,
      "total_pages": 3
    },
    "message": "Collections retrieved successfully"
  }
}
```

Business Rules:
- Returns only collections owned by authenticated user
- Search performs case-insensitive partial match on name and description
- Results ordered by creation date (newest first)
- Empty result returns items: [] with total: 0

Common Errors:
- 400: Invalid page or page_size values (must be positive integers)
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)

Integration Notes:
- Implement pagination UI using total_pages field
- Use search parameter for collection filtering
- Cache results to reduce API calls
- Display empty state when items array is empty""",
)
async def get_collections(
    page: int = Query(1, ge=1, description='Page number (starting from 1)'),
    page_size: int = Query(
        10, ge=1, le=100, description='Number of items per page (1-100)',
    ),
    search: Optional[str] = Query(
        None, description='Search term to filter collections by name or description',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Get paginated list of collections for the authenticated user.

    This endpoint retrieves collections:
    - User ID is extracted from the authentication token
    - Pagination parameters are validated
    - Collections are filtered by the authenticated user

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)

    **Parameters**:
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 10, max: 100)
    - **search**: Search term to filter collections by name or description (optional)

    Returns paginated collection data with total count and page information.
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
                    'endpoint': 'get_collections',
                    'page': page,
                    'user_id': str(current_user.user_id),
                },
            )

        if page_size < 1 or page_size > 100:
            return exception_handler.handle_bad_request(
                message='Page size must be between 1 and 100',
                extra={
                    'endpoint': 'get_collections',
                    'page_size': page_size,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Getting collections - page={page}, page_size={page_size}, '
            f'search={search}, by user: {current_user.user_id}',
        )

        # Create service input with user filter
        service_input = CollectionGettingInput(
            page=page,
            page_size=page_size,
            user_id=current_user.user_id,  # Filter by authenticated user
            search=search,
        )

        # Call the collection getting service
        result = await collection_getting_service.process(service_input, db)

        # Check if there's an error in the result message
        if not result.data and ('error' in result.message.lower() or 'failed' in result.message.lower()):
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_collections',
                    'page': page,
                    'page_size': page_size,
                    'current_user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Collections retrieved successfully - page={page}, '
            f'total={result.data.total if result.data else 0}',
        )
        return exception_handler.handle_success(output=result.model_dump(mode='json'))

    except Exception as e:
        logger.error(
            f'Failed to get collections - page={page}, page_size={page_size}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve collections: {str(e)}',
            extra={
                'endpoint': 'get_collections',
                'page': page,
                'page_size': page_size,
                'current_user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
