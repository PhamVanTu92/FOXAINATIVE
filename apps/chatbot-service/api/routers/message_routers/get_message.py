from __future__ import annotations

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_current_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import MessageResponseSamples
from app.messages import MessageGettingInput
from app.messages import MessageGettingService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Path
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
    message_getting_service = MessageGettingService(
        postgres_settings=settings.postgres,
    )
    logger.info('Message getting service initialized successfully')
except Exception as e:
    logger.error(f"Failed to initialize message getting service: {str(e)}")
    raise RuntimeError(
        f"Message getting service initialization failed: {str(e)}",
    )


@router.get(
    '/conversations/{conversation_id}/messages',
    responses=MessageResponseSamples.get_message_responses(),
    status_code=status.HTTP_200_OK,
    summary='Get messages for current user',
    description="""Retrieve paginated message history for specific conversation.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Any authenticated user

Path Parameters:
- conversation_id: UUID of conversation

Query Parameters:
- page: Page number (integer, min 1, default 1)
- page_size: Items per page (integer, min 1, max 100, default 10)
- search: Search term for filtering by message content (optional)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "data": {
      "items": [
        {
          "id": "message-uuid",
          "conversation_id": "conversation-uuid",
          "role": "user",
          "content": "What is the remote work policy?",
          "created_at": "2026-02-02T10:30:00+07:00"
        },
        {
          "id": "message-uuid-2",
          "conversation_id": "conversation-uuid",
          "role": "assistant",
          "content": "According to company policy...",
          "created_at": "2026-02-02T10:30:15+07:00"
        }
      ],
      "total": 24,
      "page": 1,
      "page_size": 10,
      "total_pages": 3
    },
    "message": "Messages retrieved successfully"
  }
}
```

Business Rules:
- Returns messages only from specified conversation
- User must own the conversation to view messages
- Messages ordered chronologically (oldest first for natural chat flow)
- role field indicates message sender: 'user' or 'assistant'
- Assistant messages may include metadata with sources and token count
- Search performs case-insensitive match on content field

Common Errors:
- 400: Invalid UUID format, invalid pagination parameters
- 401: Missing or invalid access token
- 403: User does not own this conversation
- 404: Conversation not found

Integration Notes:
- Use for displaying chat history when reopening conversation
- Implement infinite scroll or pagination for long conversations
- Display role-based styling (user vs assistant messages)
- Show source documents from metadata for transparency
- Cache recent messages to reduce API calls""",
)
async def get_messages(
    conversation_id: str = Path(
        ...,
        description='Conversation ID to fetch messages from',
    ),
    page: int = Query(1, ge=1, description='Page number (starting from 1)'),
    page_size: int = Query(
        10, ge=1, le=100, description='Number of items per page (1-100)',
    ),
    search: str = Query(
        None, description='Search query to filter messages by content',
    ),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    Get paginated list of messages for the current authenticated user.

    This endpoint retrieves messages with proper user context:
    - User ID is extracted from the authentication token (not from query parameters)
    - Messages are filtered by the authenticated user only
    - Pagination parameters are validated
    - Access control ensures users can only view their own messages

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - User can only access their own messages

    **Parameters**:
    - **conversation_id**: UUID of the conversation to fetch messages from
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 10, max: 100)
    - **search**: Optional search query to filter by message content

    Returns paginated message data with total count and page information.
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
                    'endpoint': 'get_messages',
                    'page': page,
                    'user_id': str(current_user.user_id),
                },
            )

        if page_size < 1 or page_size > 100:
            return exception_handler.handle_bad_request(
                message='Page size must be between 1 and 100',
                extra={
                    'endpoint': 'get_messages',
                    'page_size': page_size,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Getting messages - conversation_id={conversation_id}, page={page}, page_size={page_size}, '
            f'user: {current_user.user_id}',
        )

        # Create service input with conversation context
        service_input = MessageGettingInput(
            conversation_id=conversation_id,
            page=page,
            page_size=page_size,
            search_query=search,
        )

        # Call the message getting service
        result = await message_getting_service.process(service_input, db)

        # Check if there's an error in the result message
        if not result.data and ('error' in result.message.lower() or 'failed' in result.message.lower()):
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_messages',
                    'page': page,
                    'page_size': page_size,
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Messages retrieved successfully - page={page}, '
            f'total={result.data.total if result.data else 0}, '
            f'user: {current_user.user_id}',
        )
        return exception_handler.handle_success(output=result.model_dump(mode='json'))

    except Exception as e:
        logger.error(
            f'Failed to get messages - page={page}, page_size={page_size}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve messages: {str(e)}',
            extra={
                'endpoint': 'get_messages',
                'page': page,
                'page_size': page_size,
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
