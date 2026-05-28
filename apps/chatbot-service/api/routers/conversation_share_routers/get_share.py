from __future__ import annotations

import uuid

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationShareResponseSamples
from domain.db_service import GettingConversationShareInput
from domain.db_service import GettingConversationShareService
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
    getting_share_service = GettingConversationShareService(
        settings=settings.postgres,
    )
    logger.info('Conversation share getting service initialized successfully')
except Exception as e:
    logger.error(
        f'Failed to initialize conversation share getting service: {str(e)}',
    )
    raise RuntimeError(
        f'Conversation share getting service initialization failed: {str(e)}',
    )


@router.get(
    '/conversations/{conversation_id}/shares',
    summary='List all shares for a conversation',
    description="""Retrieve all active share links for a specific conversation.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- conversation_id: UUID of the conversation

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "shares": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "conversation_id": "123e4567-e89b-12d3-a456-426614174001",
        "shared_by_user_id": "123e4567-e89b-12d3-a456-426614174002",
        "permission": "view",
        "is_public": true,
        "share_token": "987fcdeb-51a2-43e7-b8c9-123456789abc",
        "created_at": "2026-02-02T10:30:00+07:00"
      }
    ],
    "total_shares": 1
  }
}
```

Business Rules:
- Returns all active (non-revoked) shares for the conversation
- Only the conversation owner can view share links
- Shares are ordered by creation date
- Empty list returned if no shares exist

Common Errors:
- 400: Invalid conversation_id format
- 401: Missing or invalid access token
- 500: Internal server error

Integration Notes:
- Use to display share management UI
- Combine with DELETE /conversations/{conversation_id}/shares/{share_id} for revocation
- Show share_token as copyable public URL""",
    responses=ConversationShareResponseSamples.get_shares_responses(),
    status_code=status.HTTP_200_OK,
)
async def get_shares(
    conversation_id: uuid.UUID = Path(
        ..., description='UUID of the conversation to list shares for',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Get all active share links for a conversation.

    Returns a list of share records including tokens, permissions,
    and creation timestamps.

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - Only the conversation owner can view shares

    **Parameters**:
    - **conversation_id**: UUID of the conversation (path parameter)

    Returns list of shares with total count.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Getting shares for conversation {conversation_id}, '
            f'user: {current_user.user_id}',
        )

        service_input = GettingConversationShareInput(
            conversation_id=conversation_id,
        )

        result = getting_share_service.process(service_input, db)

        if not result.status:
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_shares',
                    'conversation_id': str(conversation_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Serialize shares for JSON response
        shares_data = []
        for share in result.shares:
            shares_data.append({
                'id': str(share.id),
                'conversation_id': str(share.conversation_id),
                'shared_by_user_id': str(share.shared_by_user_id),
                'permission': share.permission.value if hasattr(share.permission, 'value') else str(share.permission),
                'is_public': share.is_public,
                'share_token': str(share.share_token),
                'created_at': share.created_at.isoformat() if share.created_at else None,
            })

        logger.info(
            f'Shares retrieved - conversation_id={conversation_id}, '
            f'total={result.total_shares}, user: {current_user.user_id}',
        )

        return exception_handler.handle_success(
            output={
                'shares': shares_data,
                'total_shares': result.total_shares,
            },
        )

    except Exception as e:
        logger.error(
            f'Failed to get shares for conversation {conversation_id}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve shares: {str(e)}',
            extra={
                'endpoint': 'get_shares',
                'conversation_id': str(conversation_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
