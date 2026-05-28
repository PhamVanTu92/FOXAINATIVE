from __future__ import annotations

import uuid

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationShareResponseSamples
from domain.db_service import CreatingConversationShareInput
from domain.db_service import CreatingConversationShareService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Path
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    creating_share_service = CreatingConversationShareService(
        settings=settings.postgres,
    )
    logger.info('Conversation share creating service initialized successfully')
except Exception as e:
    logger.error(
        f'Failed to initialize conversation share creating service: {str(e)}',
    )
    raise RuntimeError(
        f'Conversation share creating service initialization failed: {str(e)}',
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    '/conversations/{conversation_id}/shares',
    summary='Create a public share link for a conversation',
    description="""Create a public share link that allows anyone with the URL to view the conversation.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- conversation_id: UUID of the conversation to share

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "share_id": "123e4567-e89b-12d3-a456-426614174000",
    "share_token": "987fcdeb-51a2-43e7-b8c9-123456789abc",
    "share_url": "/shared/987fcdeb-51a2-43e7-b8c9-123456789abc"
  }
}
```

Business Rules:
- Only the conversation owner can create share links
- Each share generates a unique token for public URL access
- Share permission defaults to 'view' (read-only)
- Deleted conversations cannot be shared
- Multiple shares can exist for the same conversation

Common Errors:
- 400: Share creation failed
- 401: Missing or invalid access token
- 403: User does not own the conversation
- 404: Conversation not found
- 422: Invalid conversation_id format

Integration Notes:
- Use returned share_token to construct public URL
- Public URL format: /shared/{share_token}
- Share link can be revoked via DELETE /conversations/{conversation_id}/shares/{share_id}
- List existing shares via GET /conversations/{conversation_id}/shares""",
    responses=ConversationShareResponseSamples.create_share_responses(),
    status_code=status.HTTP_200_OK,
)
async def create_share(
    conversation_id: uuid.UUID = Path(
        ..., description='UUID of the conversation to share',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Create a public share link for a conversation.

    Generates a unique token that allows unauthenticated users to view
    the conversation at /shared/{share_token}.

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - Only the conversation owner can create share links

    **Parameters**:
    - **conversation_id**: UUID of the conversation to share (path parameter)

    Returns share_id and share_token for constructing the public URL.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Creating share for conversation {conversation_id}, '
            f'user: {current_user.user_id}',
        )

        service_input = CreatingConversationShareInput(
            conversation_id=conversation_id,
            shared_by_user_id=current_user.user_id,
        )

        result = creating_share_service.process(service_input, db)

        if not result.status:
            # Distinguish between not-found and forbidden
            if 'not found' in result.message.lower():
                return exception_handler.handle_not_found_error(
                    message=result.message,
                    extra={
                        'endpoint': 'create_share',
                        'conversation_id': str(conversation_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            if 'permission' in result.message.lower():
                return exception_handler.handle_forbidden(
                    message=result.message,
                    extra={
                        'endpoint': 'create_share',
                        'conversation_id': str(conversation_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            return exception_handler.handle_bad_request(
                message=result.message,
                extra={
                    'endpoint': 'create_share',
                    'conversation_id': str(conversation_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Share created successfully - share_id={result.share_id}, '
            f'conversation_id={conversation_id}, user: {current_user.user_id}',
        )

        return exception_handler.handle_success(
            output={
                'share_id': str(result.share_id),
                'share_token': str(result.share_token),
                'share_url': f'/shared/{result.share_token}',
            },
        )

    except Exception as e:
        logger.error(
            f'Failed to create share for conversation {conversation_id}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to create share: {str(e)}',
            extra={
                'endpoint': 'create_share',
                'conversation_id': str(conversation_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
