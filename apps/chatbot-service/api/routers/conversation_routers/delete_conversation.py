from __future__ import annotations

import uuid

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationResponseSamples
from app.conversations import ConversationDeletingInput
from app.conversations import ConversationDeletingService
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

try:
    conversation_deleting_service = ConversationDeletingService(
        postgres_settings=settings.postgres,
    )
    logger.info('Conversation deleting service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize conversation deleting service: {str(e)}",
    )
    raise RuntimeError(
        f"Conversation deleting service initialization failed: {str(e)}",
    )


@router.delete(
    '/conversations/{conversation_id}',
    summary='Delete conversation',
    description="""Delete conversation with soft or hard delete option.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- conversation_id: UUID of conversation to delete

Query Parameters:
- hard_delete: Permanent deletion if true, soft delete if false (boolean, default false)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "id": "conversation-uuid",
    "deleted": true,
    "permanently_deleted": false
  }
}
```

Business Rules:
- Soft delete (default): Sets deleted=true, data preserved, can be restored
- Hard delete: Permanently removes conversation and all messages from database
- Only conversation owner can delete
- Hard delete cascades to all associated messages and checkpoints
- Soft deleted conversations can be viewed with include_deleted=true parameter

Common Errors:
- 400: Invalid UUID format
- 401: Missing or invalid access token
- 403: User does not own this conversation
- 404: Conversation not found or already deleted

Integration Notes:
- Default to soft delete for safety (recoverable)
- Show confirmation dialog for hard delete
- Implement trash/archive view for soft-deleted conversations
- Provide restore functionality for soft-deleted items
- Use hard_delete=true only for permanent cleanup""",
    responses=ConversationResponseSamples.delete_conversation_responses(),
    status_code=status.HTTP_200_OK,
)
async def delete_conversation(
    conversation_id: uuid.UUID = Path(
        ...,
        description='Conversation ID to delete',
    ),
    hard_delete: bool = Query(
        False, description='If true, permanently delete from database. If false, soft delete (mark as deleted)',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Delete a conversation (soft or hard delete).

    **Authentication & Authorization**:
    - Requires valid Bearer token
    - User can only delete their own conversations

    **Parameters**:
    - **conversation_id**: UUID of the conversation to delete
    - **hard_delete**: If true, permanently delete from database. If false, soft delete (default)

    **Soft Delete** (hard_delete=false):
    - Marks conversation as deleted but keeps data in database
    - Can be restored later if needed
    - Recommended for most cases

    **Hard Delete** (hard_delete=true):
    - Permanently removes conversation and all associated messages from database
    - Cannot be undone
    - Use with caution

    Returns success message.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Deleting conversation {conversation_id} (hard_delete={hard_delete}) '
            f'for user: {current_user.user_id}',
        )

        # Create service input
        service_input = ConversationDeletingInput(
            conversation_id=conversation_id,
            hard_delete=hard_delete,
        )

        # Call the conversation deleting service
        result = await conversation_deleting_service.process(service_input, db)

        if not result.success:
            if 'not found' in result.message.lower():
                return exception_handler.handle_not_found_error(
                    message=result.message,
                    extra={
                        'endpoint': 'delete_conversation',
                        'conversation_id': str(conversation_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'delete_conversation',
                    'conversation_id': str(conversation_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Conversation deleted successfully - conversation_id={conversation_id}, '
            f'hard_delete={hard_delete}, user: {current_user.user_id}',
        )
        return exception_handler.handle_success(
            output={'message': result.message},
        )

    except Exception as e:
        logger.error(
            f'Failed to delete conversation {conversation_id} '
            f'for user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to delete conversation: {str(e)}',
            extra={
                'endpoint': 'delete_conversation',
                'conversation_id': str(conversation_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
