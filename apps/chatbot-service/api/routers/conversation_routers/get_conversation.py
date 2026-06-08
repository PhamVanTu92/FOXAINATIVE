from __future__ import annotations

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_current_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationResponseSamples
from app.conversations import ConversationGettingInput
from app.conversations import ConversationGettingService
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

try:
    conversation_getting_service = ConversationGettingService(
        postgres_settings=settings.postgres,
    )
    logger.info('Conversation getting service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize conversation getting service: {str(e)}",
    )
    raise RuntimeError(
        f"Conversation getting service initialization failed: {str(e)}",
    )


@router.get(
    '/conversations',
    summary='List all conversations',
    description="""Retrieve paginated list of user conversations with search and filtering.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Query Parameters:
- page: Page number (integer, min 1, default 1)
- page_size: Items per page (integer, min 1, max 100, default 10)
- include_deleted: Include soft-deleted conversations (boolean, default false)
- search: Search term for filtering by conversation title (optional)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "data": {
      "items": [
        {
          "id": "conversation-uuid",
          "user_id": "user-uuid",
          "title": "Remote work policy discussion",
          "created_at": "2026-02-02T10:30:00+07:00",
          "updated_at": "2026-02-02T11:45:00+07:00",
          "deleted": false
        }
      ],
      "total": 45,
      "page": 1,
      "page_size": 10,
      "total_pages": 5
    },
    "message": "Conversations retrieved successfully"
  }
}
```

Business Rules:
- Returns only conversations owned by authenticated user
- Ordered by most recently updated first
- Soft-deleted conversations excluded by default (use include_deleted=true to show)
- Search performs case-insensitive match on title field
- Each conversation includes message count for UI display

Common Errors:
- 400: Invalid page or page_size values
- 401: Missing or invalid access token
- 403: Insufficient permissions

Integration Notes:
- Use for displaying conversation list in sidebar
- Implement pagination for better performance
- Poll periodically to update conversation list
- Cache results to reduce API calls
- Use include_deleted for trash/archive views""",
    responses=ConversationResponseSamples.get_conversation_responses(),
    status_code=status.HTTP_200_OK,
)
async def get_conversations(
    page: int = Query(1, ge=1, description='Page number (starting from 1)'),
    page_size: int = Query(
        10, ge=1, le=100, description='Number of items per page (1-100)',
    ),
    include_deleted: bool = Query(
        False, description='Include soft-deleted conversations',
    ),
    search: str = Query(
        None, description='Search query to filter conversations by title',
    ),
    # Lịch sử hội thoại là của riêng user (service lọc theo user_id bên dưới),
    # nên mọi user đã đăng nhập đều xem được phần của mình — không bắt buộc role
    # manager. Trước đây dùng get_manager_user khiến NHAN_VIEN mở trang chat bị 403.
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    Get paginated list of conversations for the current authenticated user.

    This endpoint retrieves conversations with proper user context:
    - User ID is extracted from the authentication token (not from query parameters)
    - Conversations are filtered by the authenticated user only
    - Pagination parameters are validated
    - Access control ensures users can only view their own conversations
    - Ordered by most recently updated first

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - User can only access their own conversations

    **Parameters**:
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 10, max: 100)
    - **include_deleted**: Include soft-deleted conversations (default: false)
    - **search**: Optional search query to filter by conversation title

    Returns paginated conversation data with total count and page information.
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
                    'endpoint': 'get_conversations',
                    'page': page,
                    'user_id': str(current_user.user_id),
                },
            )

        if page_size < 1 or page_size > 100:
            return exception_handler.handle_bad_request(
                message='Page size must be between 1 and 100',
                extra={
                    'endpoint': 'get_conversations',
                    'page_size': page_size,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Getting conversations - page={page}, page_size={page_size}, '
            f'include_deleted={include_deleted}, search={search}, user: {current_user.user_id}',
        )

        # Create service input with user context from token
        service_input = ConversationGettingInput(
            user_id=current_user.user_id,
            page=page,
            page_size=page_size,
            include_deleted=include_deleted,
            search_query=search,
        )

        # Call the conversation getting service
        result = await conversation_getting_service.process(service_input, db)

        # Check if there's an error in the result message
        if not result.data and ('error' in result.message.lower() or 'failed' in result.message.lower()):
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_conversations',
                    'page': page,
                    'page_size': page_size,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Conversations retrieved successfully - page={page}, '
            f'total={result.data.total if result.data else 0}, '
            f'user: {current_user.user_id}',
        )
        return exception_handler.handle_success(output=result.model_dump(mode='json'))

    except Exception as e:
        logger.error(
            f'Failed to get conversations - page={page}, page_size={page_size}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve conversations: {str(e)}',
            extra={
                'endpoint': 'get_conversations',
                'page': page,
                'page_size': page_size,
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
