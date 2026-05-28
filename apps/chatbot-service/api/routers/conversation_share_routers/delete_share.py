from __future__ import annotations

import uuid

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationShareResponseSamples
from domain.db_service import DeletingConversationShareInput
from domain.db_service import DeletingConversationShareService
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
    deleting_share_service = DeletingConversationShareService(
        settings=settings.postgres,
    )
    logger.info('Conversation share deleting service initialized successfully')
except Exception as e:
    logger.error(
        f'Failed to initialize conversation share deleting service: {str(e)}',
    )
    raise RuntimeError(
        f'Conversation share deleting service initialization failed: {str(e)}',
    )


@router.delete(
    '/shares/{share_id}',
    summary='Revoke a conversation share link',
    description="""Revoke (delete) a previously created share link.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- share_id: UUID of the share to revoke

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Share revoked successfully"
  }
}
```

Business Rules:
- Only the user who created the share can revoke it
- Revoked shares immediately become inaccessible via public URL
- Share is permanently deleted (not soft-deleted)
- Attempting to revoke a non-existent share returns 404

Common Errors:
- 400: Invalid share_id format or revocation failed
- 401: Missing or invalid access token
- 403: User does not own this share
- 404: Share not found or already revoked

Integration Notes:
- Use share_id from GET /shares/conversation/{conversation_id} response
- Show confirmation dialog before revoking
- After revocation, public URL returns 404 immediately
- Refresh share list after successful revocation""",
    responses=ConversationShareResponseSamples.delete_share_responses(),
    status_code=status.HTTP_200_OK,
)
async def delete_share(
    share_id: uuid.UUID = Path(
        ..., description='UUID of the share to revoke',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Revoke (delete) a conversation share link.

    Permanently removes the share record, making the public URL immediately
    inaccessible. Only the user who created the share can revoke it.

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - Only the share creator can revoke it

    **Parameters**:
    - **share_id**: UUID of the share to revoke (path parameter)

    Returns success message upon revocation.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Revoking share {share_id}, user: {current_user.user_id}',
        )

        service_input = DeletingConversationShareInput(
            share_id=share_id,
            user_id=current_user.user_id,
        )

        result = deleting_share_service.process(service_input, db)

        if not result.status:
            if 'not found' in result.message.lower():
                return exception_handler.handle_not_found_error(
                    message=result.message,
                    extra={
                        'endpoint': 'delete_share',
                        'share_id': str(share_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            if 'permission' in result.message.lower():
                return exception_handler.handle_forbidden(
                    message=result.message,
                    extra={
                        'endpoint': 'delete_share',
                        'share_id': str(share_id),
                        'user_id': str(current_user.user_id),
                    },
                )
            return exception_handler.handle_bad_request(
                message=result.message,
                extra={
                    'endpoint': 'delete_share',
                    'share_id': str(share_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Share revoked successfully - share_id={share_id}, '
            f'user: {current_user.user_id}',
        )

        return exception_handler.handle_success(
            output={'message': result.message},
        )

    except Exception as e:
        logger.error(
            f'Failed to revoke share {share_id}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to revoke share: {str(e)}',
            extra={
                'endpoint': 'delete_share',
                'share_id': str(share_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
