from __future__ import annotations

import uuid

from api.helpers.dependencies.database import get_db_session
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationShareResponseSamples
from domain.db_service import GettingConversationShareByTokenInput
from domain.db_service import GettingConversationShareByTokenService
from domain.db_service import GettingMessagePaginationInput
from domain.db_service import GettingMessagePaginationService
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
    getting_share_by_token_service = GettingConversationShareByTokenService(
        settings=settings.postgres,
    )
    getting_message_service = GettingMessagePaginationService(
        settings=settings.postgres,
    )
    logger.info('Shared conversation access services initialized successfully')
except Exception as e:
    logger.error(
        f'Failed to initialize shared conversation access services: {str(e)}',
    )
    raise RuntimeError(
        f'Shared conversation access service initialization failed: {str(e)}',
    )


@router.get(
    '/shared/{share_token}',
    summary='Access a shared conversation (public, no auth required)',
    description="""Access a publicly shared conversation via its share token.

Authentication: NOT Required
- This endpoint is publicly accessible to anyone with the share token

Path Parameters:
- share_token: UUID token from the shared link

Query Parameters:
- page: Page number for messages (integer, min 1, default 1)
- page_size: Messages per page (integer, min 1, max 100, default 50)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "conversation_id": "123e4567-e89b-12d3-a456-426614174001",
    "shared_by": "123e4567-e89b-12d3-a456-426614174002",
    "messages": {
      "messages": [
        {
          "message": {
            "id": "123e4567-e89b-12d3-a456-426614174010",
            "type": "human",
            "contents": "What is the policy?",
            "created_at": "2026-02-02T10:30:00+07:00"
          },
          "file_attachments": []
        }
      ],
      "total": 15,
      "page": 1,
      "page_size": 50,
      "total_pages": 1
    }
  }
}
```

Business Rules:
- No authentication required - anyone with the token can access
- Only 'view' permission: read-only access to messages
- Messages include file attachment metadata (if any)
- Expired shares return 404
- Revoked shares return 404
- Supports pagination for conversations with many messages

Common Errors:
- 400: Invalid token format or pagination parameters
- 404: Share not found, expired, or revoked
- 500: Internal server error

Integration Notes:
- Use share_token from URL path
- Render messages in read-only mode (no input field)
- Implement infinite scroll or pagination for message loading
- Display shared conversation title and attribution
- Handle 404 gracefully with 'Link expired or not found' message""",
    responses=ConversationShareResponseSamples.access_shared_responses(),
    status_code=status.HTTP_200_OK,
)
async def access_shared_conversation(
    share_token: uuid.UUID = Path(
        ..., description='Share token from the public URL',
    ),
    page: int = Query(
        1, ge=1, description='Page number for messages (starting from 1)',
    ),
    page_size: int = Query(
        50, ge=1, le=100, description='Number of messages per page (1-100)',
    ),
    db: Session = Depends(get_db_session),
):
    """
    Access a publicly shared conversation (no authentication required).

    Validates the share token, then retrieves paginated messages from
    the shared conversation in read-only mode.

    **Authentication & Authorization**:
    - NO authentication required (public endpoint)
    - Access granted to anyone with a valid, non-expired share token

    **Parameters**:
    - **share_token**: UUID token from the shared URL (path parameter)
    - **page**: Page number for messages (default: 1)
    - **page_size**: Messages per page (default: 50, max: 100)

    Returns conversation metadata and paginated messages.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Accessing shared conversation with token {share_token}, '
            f'page={page}, page_size={page_size}',
        )

        # Validate pagination
        if page < 1:
            return exception_handler.handle_bad_request(
                message='Page number must be greater than 0',
                extra={
                    'endpoint': 'access_shared_conversation',
                    'share_token': str(share_token),
                    'page': page,
                },
            )

        if page_size < 1 or page_size > 100:
            return exception_handler.handle_bad_request(
                message='Page size must be between 1 and 100',
                extra={
                    'endpoint': 'access_shared_conversation',
                    'share_token': str(share_token),
                    'page_size': page_size,
                },
            )

        # Step 1: Validate share token
        share_input = GettingConversationShareByTokenInput(
            share_token=share_token,
        )
        share_result = getting_share_by_token_service.process(share_input, db)

        if not share_result.status or not share_result.share:
            return exception_handler.handle_not_found_error(
                message='Share not found, expired, or has been revoked',
                extra={
                    'endpoint': 'access_shared_conversation',
                    'share_token': str(share_token),
                },
            )

        share = share_result.share

        # Step 2: Get paginated messages
        message_input = GettingMessagePaginationInput(
            conversation_id=share.conversation_id,
            page=page,
            page_size=page_size,
        )
        message_result = getting_message_service.process(message_input, db)

        if not message_result.status:
            return exception_handler.handle_exception(
                e=message_result.message,
                extra={
                    'endpoint': 'access_shared_conversation',
                    'share_token': str(share_token),
                    'conversation_id': str(share.conversation_id),
                },
            )

        logger.info(
            f'Shared conversation accessed - token={share_token}, '
            f'conversation_id={share.conversation_id}, '
            f'messages_total={message_result.data.total if message_result.data else 0}',
        )

        return exception_handler.handle_success(
            output={
                'conversation_id': str(share.conversation_id),
                'shared_by': str(share.shared_by_user_id),
                'messages': message_result.data.model_dump(mode='json') if message_result.data else None,
            },
        )

    except Exception as e:
        logger.error(
            f'Failed to access shared conversation - token={share_token}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to access shared conversation: {str(e)}',
            extra={
                'endpoint': 'access_shared_conversation',
                'share_token': str(share_token),
                'error': str(e),
            },
        )
