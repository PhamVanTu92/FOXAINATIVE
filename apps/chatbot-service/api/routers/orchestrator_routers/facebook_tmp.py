"""Temporary Facebook Messenger webhook router.

This router is isolated from the existing facebook router and uses
FacebookTmpService (TMP_FACEBOOK__* + LangGraph in-memory runtime).
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import OrchestratorResponseSamples
from app.orchestrator.facebook_tmp import FacebookTmpService
from fastapi import APIRouter
from fastapi import Request
from fastapi import status
from fastapi.responses import JSONResponse
from fastapi.responses import PlainTextResponse
from joint.logging import get_logger
from joint.utils import get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()

# Singleton temporary service
_facebook_tmp_service = FacebookTmpService(settings=settings)


@router.get(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.facebook_verify_responses(),
    summary='Facebook TMP Webhook Verification',
    tags=['facebook-tmp'],
)
async def verify_webhook(request: Request) -> PlainTextResponse:
    """Verify Facebook webhook subscription using TMP_FACEBOOK__VERIFY_TOKEN."""
    mode = request.query_params.get('hub.mode')
    token = request.query_params.get('hub.verify_token')
    challenge = request.query_params.get('hub.challenge', '')

    if mode == 'subscribe' and _facebook_tmp_service.verify_webhook_token(token or ''):
        logger.info('Facebook TMP webhook verified successfully')
        return PlainTextResponse(content=challenge, status_code=status.HTTP_200_OK)

    logger.warning(
        'Facebook TMP webhook verification failed',
        extra={
            'mode': mode,
            'token_match': _facebook_tmp_service.verify_webhook_token(token or ''),
        },
    )
    return PlainTextResponse(content='Forbidden', status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.facebook_webhook_responses(),
    summary='Facebook TMP Webhook - Receive Messages',
    tags=['facebook-tmp'],
)
async def receive_webhook(request: Request) -> JSONResponse:
    """Receive Facebook messages and process asynchronously in tmp flow."""
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    raw_body = await request.body()
    signature = request.headers.get('X-Hub-Signature-256', '')

    if not _facebook_tmp_service.verify_signature(raw_body, signature):
        return exception_handler.handle_forbidden(
            message='X-Hub-Signature-256 verification failed',
            extra={'signature_present': bool(signature)},
        )

    try:
        body: Dict[str, Any] = await request.json()
    except Exception as e:
        return exception_handler.handle_bad_request(
            message='Invalid JSON body',
            extra={'error': str(e)},
        )

    payload = _facebook_tmp_service.parse_payload(body)

    if not payload.is_valid:
        return JSONResponse(
            content={'status': 'ignored'},
            status_code=status.HTTP_200_OK,
        )

    queued = 0
    for message in payload.messages:
        if not message.message_text.strip():
            continue

        logger.info(
            'Queueing Facebook TMP message for background processing',
            extra={
                'sender_id': message.sender_id[:8] + '***',
                'message_id': message.message_id,
                'message_length': len(message.message_text),
                'is_postback': message.is_postback,
            },
        )

        asyncio.create_task(_facebook_tmp_service.handle_message(message))
        queued += 1

    logger.info(
        f'Facebook TMP webhook: queued {queued} message(s)',
        extra={'total_messages': len(payload.messages), 'queued': queued},
    )

    return JSONResponse(content={'status': 'ok'}, status_code=status.HTTP_200_OK)
