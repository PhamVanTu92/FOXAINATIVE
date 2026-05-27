"""Facebook Messenger webhook router — webhook verification and message ingestion.

Endpoints:
    GET  /webhook — Facebook webhook verification (hub.mode, hub.verify_token, hub.challenge)
    POST /webhook — Receive incoming Facebook messages, process via agent in background
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from api.helpers.dependencies.database import get_async_db_session_factory
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import OrchestratorResponseSamples
from app.orchestrator.facebook import FacebookService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Request
from fastapi import status
from fastapi.responses import JSONResponse
from fastapi.responses import PlainTextResponse
from joint.logging import get_logger
from joint.utils import get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()

# Singleton service — shared across requests (stateless)
_facebook_service = FacebookService(settings=settings)


@router.get(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.facebook_verify_responses(),
    summary='Facebook Webhook Verification',
    tags=['facebook'],
)
async def verify_webhook(request: Request) -> PlainTextResponse:
    """Verify webhook subscription challenge from Facebook Developer Console.

Authentication: None — Facebook sends this before the webhook is approved.

Query Parameters:
```
hub.mode         = "subscribe"
hub.verify_token = <must match FACEBOOK__VERIFY_TOKEN in .env>
hub.challenge    = <random string to echo back>
```

Facebook Verification Flow:
1. Configure Callback URL and Verify Token in Facebook Developer Console.
2. Facebook sends a GET request with the three query params above.
3. If hub.verify_token matches, return hub.challenge as plain text (200 OK).
4. Facebook confirms the webhook and activates message delivery.

Response:
- 200 + challenge string: Verification successful, webhook activated.
- 403 Forbidden: Token mismatch — webhook not activated.

Configuration:
- Set FACEBOOK__VERIFY_TOKEN in .env to any secret string.
- Use the same string in Facebook Developer Console → Messenger → Settings → Webhooks.
"""
    mode = request.query_params.get('hub.mode')
    token = request.query_params.get('hub.verify_token')
    challenge = request.query_params.get('hub.challenge', '')

    if mode == 'subscribe' and _facebook_service.verify_webhook_token(token):
        logger.info('Facebook webhook verified successfully')
        return PlainTextResponse(content=challenge, status_code=status.HTTP_200_OK)

    logger.warning(
        'Facebook webhook verification failed',
        extra={
            'mode': mode,
            'token_match': token == settings.facebook.verify_token,
        },
    )
    return PlainTextResponse(content='Forbidden', status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.facebook_webhook_responses(),
    summary='Facebook Webhook — Receive Messages',
    tags=['facebook'],
)
async def receive_webhook(
    request: Request,
    db_session_factory=Depends(get_async_db_session_factory),
) -> JSONResponse:
    """Receive incoming Facebook Messenger messages and process via agent in background.

Authentication: None — Facebook signs each request with X-Hub-Signature-256 (HMAC-SHA256).

Security:
- Signature is verified using FACEBOOK__APP_SECRET before processing.
- If APP_SECRET is not set, signature check is skipped (dev mode only).

Webhook Payload (from Facebook):
```json
{
  "object": "page",
  "entry": [{
    "id": "<PAGE_ID>",
    "time": 1234567890,
    "messaging": [{
      "sender": {"id": "<PSID>"},
      "recipient": {"id": "<PAGE_ID>"},
      "timestamp": 1234567890,
      "message": {"mid": "mid.xxx", "text": "Hello chatbot!"}
    }]
  }]
}
```

Processing Flow:
1. Verify X-Hub-Signature-256 using HMAC-SHA256 + FACEBOOK__APP_SECRET.
2. Parse payload — extract text messages and postbacks.
3. Return {"status": "ok"} immediately (Facebook requires response within 20 seconds).
4. Each message dispatched as asyncio background task:
   a. Generate deterministic user_id from PSID (UUID v5).
   b. Send typing indicator to user.
   c. Invoke StreamAgentService to run the RAG agent pipeline.
   d. Collect full response from the SSE stream.
   e. Send reply via Facebook Send API.

Response:
- 200 {"status": "ok"}      — Message accepted and queued for processing.
- 200 {"status": "ignored"} — Non-page event acknowledged.
- 400 {"error": "..."}      — Invalid JSON body.
- 403 {"error": "..."}      — X-Hub-Signature-256 mismatch.
- 500                        — Unexpected server error.

Supported Event Types:
- message (text): Processed via agent pipeline, reply sent back.
- postback: Button clicks processed as text messages.
- All other types (image, audio, etc.): Currently ignored.

Business Rules:
- Each PSID maps to a deterministic user_id (UUID v5 — consistent across restarts).
- A new conversation is auto-created per incoming message.
- Replies are sent back to the sender via Facebook Send API.
- Messages exceeding 2000 chars are auto-split into multiple Facebook messages.
"""
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Verify Facebook signature before touching the body
    raw_body = await request.body()
    signature = request.headers.get('X-Hub-Signature-256', '')

    if not _facebook_service.verify_signature(raw_body, signature):
        return exception_handler.handle_forbidden(
            message='X-Hub-Signature-256 verification failed',
            extra={'signature_present': bool(signature)},
        )

    # Parse JSON body
    try:
        body: Dict[str, Any] = await request.json()
    except Exception as e:
        return exception_handler.handle_bad_request(
            message='Invalid JSON body',
            extra={'error': str(e)},
        )

    # Extract messages from payload
    payload = _facebook_service.parse_payload(body)

    if not payload.is_valid:
        # Non-page event — acknowledge without processing
        return JSONResponse(
            content={'status': 'ignored'},
            status_code=status.HTTP_200_OK,
        )

    # Dispatch each message as a background task
    queued = 0
    for message in payload.messages:
        if not message.message_text.strip():
            continue

        logger.info(
            'Queuing Facebook message for background processing',
            extra={
                'sender_id': message.sender_id[:8] + '***',
                'message_id': message.message_id,
                'message_length': len(message.message_text),
                'is_postback': message.is_postback,
            },
        )
        asyncio.create_task(
            _facebook_service.handle_message(message, db_session_factory),
        )
        queued += 1

    logger.info(
        f'Facebook webhook: queued {queued} message(s)',
        extra={'total_messages': len(payload.messages), 'queued': queued},
    )

    # Respond immediately — Facebook requires acknowledgement within 20s
    return JSONResponse(content={'status': 'ok'}, status_code=status.HTTP_200_OK)
