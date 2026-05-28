"""WhatsApp webhook router — Meta webhook verification and message ingestion.

Endpoints:
    GET  /webhook — Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
    POST /webhook — Receive incoming WhatsApp messages, process via agent in background
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from api.helpers.dependencies.database import get_async_db_session_factory
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import OrchestratorResponseSamples
from app.orchestrator.whatsapp import WhatsAppService
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
_whatsapp_service = WhatsAppService(settings=settings)


@router.get(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.whatsapp_verify_responses(),
    summary='WhatsApp Webhook Verification',
    tags=['whatsapp'],
)
async def verify_webhook(request: Request) -> PlainTextResponse:
    """Verify webhook subscription challenge from Meta Developer Console.

Authentication: None — Meta sends this before the webhook is approved.

Query Parameters:
```
hub.mode         = "subscribe"
hub.verify_token = <must match WHATSAPP__VERIFY_TOKEN in .env>
hub.challenge    = <random string to echo back>
```

Meta Verification Flow:
1. Configure Callback URL and Verify Token in Meta Developer Console.
2. Meta sends a GET request with the three query params above.
3. If hub.verify_token matches, return hub.challenge as plain text (200 OK).
4. Meta confirms the webhook and activates message delivery.

Response:
- 200 + challenge string: Verification successful, webhook activated.
- 403 Forbidden: Token mismatch — webhook not activated.

Configuration:
- Set WHATSAPP__VERIFY_TOKEN in .env to any secret string.
- Use the same string in Meta Developer Console → WhatsApp → Configuration → Webhook.
"""
    mode = request.query_params.get('hub.mode')
    token = request.query_params.get('hub.verify_token')
    challenge = request.query_params.get('hub.challenge', '')

    if mode == 'subscribe' and token == settings.whatsapp.verify_token:
        logger.info('WhatsApp webhook verified successfully')
        return PlainTextResponse(content=challenge, status_code=status.HTTP_200_OK)

    logger.warning(
        'WhatsApp webhook verification failed',
        extra={
            'mode': mode,
            'token_match': token == settings.whatsapp.verify_token,
        },
    )
    return PlainTextResponse(content='Forbidden', status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    '/webhook',
    response_model=None,
    responses=OrchestratorResponseSamples.whatsapp_webhook_responses(),
    summary='WhatsApp Webhook — Receive Messages',
    tags=['whatsapp'],
)
async def receive_webhook(
    request: Request,
    db_session_factory=Depends(get_async_db_session_factory),
) -> JSONResponse:
    """Receive incoming WhatsApp messages from Meta and process via agent in background.

Authentication: None — Meta signs each request with X-Hub-Signature-256 (HMAC-SHA256).

Security:
- Signature is verified using WHATSAPP__APP_SECRET before processing.
- If APP_SECRET is not set, signature check is skipped (dev mode only).

Webhook Payload (from Meta):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "contacts": [{"wa_id": "84976378034", "profile": {"name": "John"}}],
        "messages": [{
          "from": "84976378034",
          "id": "wamid.ABC123",
          "timestamp": "1709000000",
          "type": "text",
          "text": {"body": "Hello chatbot!"}
        }]
      },
      "field": "messages"
    }]
  }]
}
```

Processing Flow:
1. Verify X-Hub-Signature-256 using HMAC-SHA256 + WHATSAPP__APP_SECRET.
2. Parse payload — extract text messages only (ignores media, reactions, etc.).
3. Return {"status": "ok"} immediately (Meta requires response within 20 seconds).
4. Each message dispatched as asyncio background task:
   a. Generate deterministic user_id from phone number (UUID v5).
   b. Invoke StreamAgentService to run the RAG agent pipeline.
   c. Collect full response from the SSE stream.
   d. Send reply via WhatsApp Cloud API (graph.facebook.com).

Response:
- 200 {"status": "ok"}      — Message accepted and queued for processing.
- 200 {"status": "ignored"} — Non-message event (delivery receipts, etc.) acknowledged.
- 400 {"error": "..."}      — Invalid JSON body.
- 403 {"error": "..."}      — X-Hub-Signature-256 mismatch.
- 500                        — Unexpected server error.

Supported Message Types:
- text: Processed via agent pipeline, reply sent back.
- All other types (image, audio, document, etc.): Currently ignored.

Business Rules:
- Each phone number maps to a deterministic user_id (UUID v5 — consistent across restarts).
- A new conversation is auto-created per incoming message.
- Replies are sent back to the sender via Graph API.
- Messages exceeding 4096 chars are auto-split into multiple WhatsApp messages.
"""
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Verify Meta signature before touching the body
    raw_body = await request.body()
    signature = request.headers.get('X-Hub-Signature-256', '')

    if not _whatsapp_service.verify_signature(raw_body, signature):
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

    # Extract text messages from payload
    payload = _whatsapp_service.parse_payload(body)

    if not payload.is_valid:
        # Non-whatsapp_business_account event — acknowledge without processing
        return JSONResponse(
            content={'status': 'ignored'},
            status_code=status.HTTP_200_OK,
        )

    # Dispatch each text message as a background task
    queued = 0
    for message in payload.messages:
        if not message.message_text.strip():
            continue

        logger.info(
            'Queuing WhatsApp message for background processing',
            extra={
                'phone': message.phone_number[:6] + '***',
                'message_id': message.message_id,
                'message_length': len(message.message_text),
            },
        )
        asyncio.create_task(
            _whatsapp_service.handle_message(message, db_session_factory),
        )
        queued += 1

    logger.info(
        f'WhatsApp webhook: queued {queued} message(s)',
        extra={'total_messages': len(payload.messages), 'queued': queued},
    )

    # Respond immediately — Meta requires acknowledgement within 20s
    return JSONResponse(content={'status': 'ok'}, status_code=status.HTTP_200_OK)
