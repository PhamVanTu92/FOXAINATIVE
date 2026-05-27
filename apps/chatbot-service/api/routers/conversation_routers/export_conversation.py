"""Router for exporting conversations to Excel."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ConversationResponseSamples
from app.conversations import ConversationExportInput
from app.conversations import ConversationExportService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from fastapi.responses import Response
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    conversation_export_service = ConversationExportService(
        postgres_settings=settings.postgres,
    )
    logger.info('Conversation export service initialized successfully')
except Exception as e:
    logger.error(f"Failed to initialize conversation export service: {e}")
    raise RuntimeError(
        f"Conversation export service initialization failed: {e}",
    )


@router.get(
    '/conversations/export',
    summary='Export conversations to Excel',
    description="""Export all Q&A pairs from user conversations to an Excel file.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Query Parameters:
- start_date: Filter messages from this date (ISO format, optional)
- end_date: Filter messages until this date (ISO format, optional)

Success Response (200):
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Content-Disposition: attachment; filename="conversations_export_YYYYMMDD_HHMMSS.xlsx"

Excel Format:
| Timestamp | User Question | Bot Answer | Conversation Title |

Business Rules:
- Exports all user's conversations (not all users)
- Q&A pairs are grouped from human-ai message sequences
- Date filters are optional; without them, all conversations are exported
- Only completed Q&A pairs (human question + ai answer) are included
- Messages ordered chronologically by creation time

Common Errors:
- 401: Missing or invalid access token
- 403: Insufficient permissions (Manager role required)
- 500: Internal server error during export

Integration Notes:
- Use for downloading conversation history as Excel
- File is generated in-memory and streamed directly to prevent memory issues
- Date filters support ISO format: 2026-02-13T00:00:00 or 2026-02-13
- Filename includes timestamp to prevent conflicts
- Compatible with Excel, LibreOffice, Google Sheets""",
    responses=ConversationResponseSamples.export_conversation_responses(),
    status_code=status.HTTP_200_OK,
)
async def export_conversations(
    start_date: Optional[datetime] = Query(
        None, description='Filter messages from this date (ISO format)',
    ),
    end_date: Optional[datetime] = Query(
        None, description='Filter messages until this date (ISO format)',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Export all conversations to Excel file.

    This endpoint exports all Q&A pairs from user's conversations:
    - User ID is extracted from the authentication token
    - Optional date range filtering
    - Returns Excel file as binary response

    **Authentication & Authorization**:
    - Requires valid Bearer token
    - Manager role required

    **Parameters**:
    - **start_date**: Optional start date filter (ISO format)
    - **end_date**: Optional end date filter (ISO format)

    Returns Excel file with columns: Timestamp, User Question, Bot Answer, Conversation Title.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Exporting conversations - user: {current_user.user_id}, '
            f'start_date: {start_date}, end_date: {end_date}',
        )

        service_input = ConversationExportInput(
            user_id=current_user.user_id,
            start_date=start_date,
            end_date=end_date,
        )

        result = await conversation_export_service.process(service_input, db)

        if not result.status or not result.file_content:
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'export_conversations',
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Export completed successfully - user: {current_user.user_id}',
        )

        return Response(
            content=result.file_content,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{result.filename}"',
            },
        )

    except Exception as e:
        logger.error(
            f'Failed to export conversations - user: {current_user.user_id}: {e}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to export conversations: {e}',
            extra={
                'endpoint': 'export_conversations',
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
