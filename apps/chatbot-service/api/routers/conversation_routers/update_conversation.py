from __future__ import annotations

import uuid
from typing import Optional

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationResponseSamples
from app.conversations import ConversationUpdatingInput
from app.conversations import ConversationUpdatingService
from fastapi import APIRouter
from fastapi import Body
from fastapi import Depends
from fastapi import Path
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    conversation_updating_service = ConversationUpdatingService(
        postgres_settings=settings.postgres,
    )
    logger.info('Conversation updating service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize conversation updating service: {str(e)}",
    )
    raise RuntimeError(
        f"Conversation updating service initialization failed: {str(e)}",
    )


class UpdateConversationRequest(BaseModel):
    """Request body for updating conversation"""
    title: Optional[str] = Body(
        None,
        description='New title for the conversation',
        min_length=1,
        max_length=200,
    )
    deleted: Optional[bool] = Body(
        None,
        description='Mark conversation as deleted (true) or restore it (false)',
    )


@router.put(
    '/conversations/{conversation_id}',
    summary='Update conversation title',
    description="""Update conversation title or toggle deleted status.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- conversation_id: UUID of conversation to update

Request Body (all fields optional):
```json
{
  "title": "Updated conversation title",
  "deleted": false
}
```

Validation Rules:
- title: Optional, 1-200 characters
- deleted: Optional, boolean (true for soft delete, false to restore)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "id": "conversation-uuid",
    "user_id": "user-uuid",
    "title": "Updated conversation title",
    "created_at": "2026-02-02T10:30:00+07:00",
    "updated_at": "2026-02-02T15:20:00+07:00",
    "deleted": false
  }
}
```

Business Rules:
- Only conversation owner can update
- Partial updates supported (provide only fields to change)
- updated_at timestamp automatically updated
- Soft delete preserves conversation and message history
- Deleted conversations can be restored by setting deleted=false

Common Errors:
- 400: Invalid UUID format, title too long, empty title
- 401: Missing or invalid access token
- 403: User does not own this conversation
- 404: Conversation not found
- 422: Validation error on field constraints

Integration Notes:
- Use for renaming conversations in UI
- Implement soft delete for trash functionality
- Show restore option for deleted conversations
- Update local cache after successful update""",
    responses=ConversationResponseSamples.update_conversation_responses(),
    status_code=status.HTTP_200_OK,
)
async def update_conversation(
    conversation_id: uuid.UUID = Path(
        ...,
        description='Conversation ID to update',
    ),
    request_body: UpdateConversationRequest = Body(...),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Update an existing conversation (title or soft delete).

    **Authentication & Authorization**:
    - Requires valid Bearer token
    - User can only update their own conversations

    **Parameters**:
    - **conversation_id**: UUID of the conversation to update
    - **title**: New title (optional)
    - **deleted**: Set to true for soft delete (optional)

    Returns success message.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Updating conversation {conversation_id} for user: {current_user.user_id}',
        )

        # Create service input
        service_input = ConversationUpdatingInput(
            conversation_id=conversation_id,
            title=request_body.title,
            deleted=request_body.deleted,
        )

        # Call the conversation updating service
        result = await conversation_updating_service.process(service_input, db)

        if not result.success:
            if 'not found' in result.message.lower():
                return exception_handler.handle_not_found_error(
                    message=result.message,
                    extra={
                        'endpoint': 'update_conversation',
                        'conversation_id': str(conversation_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'update_conversation',
                    'conversation_id': str(conversation_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Conversation updated successfully - conversation_id={conversation_id}, '
            f'user: {current_user.user_id}',
        )
        return exception_handler.handle_success(
            output={'message': result.message},
        )

    except Exception as e:
        logger.error(
            f'Failed to update conversation {conversation_id} '
            f'for user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to update conversation: {str(e)}',
            extra={
                'endpoint': 'update_conversation',
                'conversation_id': str(conversation_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
