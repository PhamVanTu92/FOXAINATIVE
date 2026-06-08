from __future__ import annotations

import asyncio

from api.helpers.chatbot_resolver import resolve_chatbot
from api.routers.tts_routers.tts_router import ALLOWED_VOICES
from api.helpers.dependencies.database import get_async_db_session_factory
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import chatbot_module_code
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_current_user
from api.helpers.dependencies.shared_auth import has_permission
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import OrchestratorResponseSamples
from api.helpers.validators import MAX_USER_INPUT_CHARS
from api.helpers.validators import MAX_USER_INPUT_TOKENS
from api.helpers.validators import validate_user_input_length
from app.orchestrator.agentic import StreamAgentInput
from app.orchestrator.agentic import StreamAgentRequestBody
from app.orchestrator.agentic import StreamAgentService
from fastapi import APIRouter
from fastapi import Body
from fastapi import Depends
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

logger = get_logger(__name__)
# Initialize settings
settings = get_settings()

router = APIRouter()


@router.post(
    '/chat/stream',
    response_model=None,
    responses=OrchestratorResponseSamples.agentic_stream_responses(),
)
async def invoke_agent_streamed(
    request_body: StreamAgentRequestBody = Body(...),
    current_user: CurrentUser = Depends(get_current_user),
    # Async session factory for short-lived DB access (no threadpool, greenlet-based)
    db_session_factory=Depends(get_async_db_session_factory),
    # Sync session for synchronous chatbot resolution (one-off lookup at request start).
    db: Session = Depends(get_db_session),
) -> EventSourceResponse:
    """Stream AI responses using Server-Sent Events for real-time chat interaction.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Any authenticated user

Request Body:
```json
{
  "message": "What is the company policy on remote work?",
  "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
  "file_ids": ["file-uuid-1", "file-uuid-2"],
  "provider_llm": "openai",
  "provider_storage": "qdrant",
  "provider_embedding": "openai",
  "collection_name": "company_policies"
}
```

Validation Rules:
- message: Required, 1-2000 characters
- conversation_id: Optional, UUID for continuing existing conversation
- file_ids: Optional, array of file UUIDs from /files/upload endpoint
- provider_llm: Optional, default "openai" (enum: openai, anthropic, groq)
- provider_storage: Optional, default "qdrant"
- provider_embedding: Optional, default "openai"
- collection_name: Optional, default "chatbot-foxai"

Response: Server-Sent Events (SSE) stream
```
data: {"name":"agent","type":"message_chunk","id":"run--08671bb5-5ac2-42a4-9982-c34faca16b37","content":"Ph","language":"","finishReason":"","artifact":null, "conversation_id":"uuid-123"}

data: {"name":"agent","type":"message_chunk","id":"run--08671bb5-5ac2-42a4-9982-c34faca16b37","content":"òng","language":"","finishReason":"","artifact":null, "conversation_id":"uuid-123"}

data: {"name":"agent","type":"message_chunk","id":"run--08671bb5-5ac2-42a4-9982-c34faca16b37","content":" họ","language":"","finishReason":"","artifact":null, "conversation_id":"uuid-123"}
```

SSE Event Structure:
- name: "agent" (agent identifier)
- type: "message_chunk" (chunk type)
- id: "run--<uuid>" (unique run identifier)
- content: Token fragment (can be single char or word)
- language: Empty string (reserved)
- finishReason: Empty string until stream ends
- artifact: null (reserved for future use)
- conversation_id: UUID string for client tracking

Business Rules:
- User ID automatically extracted from JWT token
- Conversation automatically created/resumed
- Messages stored with checkpoints for conversation continuity
- Real-time streaming for responsive user experience
- Retrieves relevant documents from specified collection
- Supports multiple LLM providers for flexibility

Common Errors:
- 400: Invalid message length, invalid provider values
- 401: Missing or invalid access token
- 422: Message validation failed
- 500: LLM service unavailable, storage connection failed

Integration Notes:
- Use EventSource API for consuming SSE stream
- Parse JSON from each data: line
- Handle token type events to build response incrementally
- Show typing indicator during streaming
- Store conversation_id from response metadata for message history

JavaScript Example:
```javascript
const eventSource = new EventSource('/api/v1/chat/stream', {
  headers: { 'Authorization': 'Bearer <token>' }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message_chunk') {
    // Append content to display
    appendToResponse(data.content);

    // Check if stream finished
    if (data.finishReason) {
      console.log('Stream finished:', data.finishReason);
      eventSource.close();
    }
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```"""
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Extract user_id from authenticated token
    user_id = current_user.user_id
    message = request_body.message

    # Validate input using exception_handler
    if not message:
        return exception_handler.handle_bad_request(
            message='message is required',
            extra={'field': 'message', 'user_id': str(user_id)},
        )

    if not message.strip():
        return exception_handler.handle_bad_request(
            message='message cannot be empty',
            extra={'field': 'message', 'user_id': str(user_id)},
        )

    # Validate message length (character and token limits)
    is_valid, error_message, token_count = validate_user_input_length(
        message=message,
        user_id=str(user_id),
    )

    if not is_valid:
        return exception_handler.handle_bad_request(
            message=error_message,
            extra={
                'field': 'message',
                'user_id': str(user_id),
                'token_count': token_count,
                'max_tokens': MAX_USER_INPUT_TOKENS,
                'max_chars': MAX_USER_INPUT_CHARS,
            },
        )

    # ── Resolve chatbot config (foxai-native): if chatbot_id is provided
    # the chatbot's stored settings override providers/collections/prompt.
    overrides = None
    if request_body.chatbot_id is not None:
        overrides = resolve_chatbot(db, chatbot_id=request_body.chatbot_id)
        if overrides is None:
            return exception_handler.handle_bad_request(
                message='Chatbot not found or inactive',
                extra={'chatbot_id': str(request_body.chatbot_id)},
            )
        # Per-bot chat permission (XEM = READ): allow the bot owner, anyone
        # granted CHATBOT_<id>.READ, or admins. Others are forbidden.
        bot = overrides.chatbot
        if bot.user_id != user_id and not has_permission(
            current_user, chatbot_module_code(bot.id), 'READ',
        ):
            return exception_handler.handle_forbidden(
                message='Bạn không có quyền chat với chatbot này',
                extra={
                    'chatbot_id': str(request_body.chatbot_id),
                    'user_id': str(user_id),
                },
            )

    provider_llm = (overrides.provider_llm if overrides and overrides.provider_llm else request_body.provider_llm)
    provider_embedding = (
        overrides.provider_embedding
        if overrides and overrides.provider_embedding
        else request_body.provider_embedding
    )
    collection_names = (
        overrides.collection_names
        if overrides and overrides.collection_names
        else [request_body.collection_name]
    )
    chatbot_instructions = overrides.chatbot_instructions if overrides else ''
    faq_block = overrides.faq_block if overrides else ''
    chatbot_id = overrides.chatbot.id if overrides else None

    # Inline streaming voice (approach C): only when the client opts in AND the
    # bound chatbot is voice-enabled. A per-bot preferred voice may be stored in
    # widget_theme.voiceName; otherwise the server default applies downstream.
    tts_voice_enabled = bool(request_body.inline_audio)
    tts_voice_name = None
    if overrides is not None:
        bot = overrides.chatbot
        if bot.form not in ('voice', 'both'):
            tts_voice_enabled = False
        if isinstance(bot.widget_theme, dict):
            preferred = bot.widget_theme.get('voiceName')
            if isinstance(preferred, str) and preferred:
                tts_voice_name = preferred
    # Per-request voice pick (from the voice selector) wins over the bot default.
    if request_body.voice_id and request_body.voice_id in ALLOWED_VOICES:
        tts_voice_name = request_body.voice_id

    try:
        # Create StreamAgentInput with user_id from token and provider information from request
        stream_agent_input = StreamAgentInput(
            user_id=user_id,
            message=message,
            # Pass conversation_id from request (None for new conversation)
            conversation_id=request_body.conversation_id,
            file_ids=request_body.file_ids,
            provider_llm=provider_llm,
            provider_storage=request_body.provider_storage,
            provider_embedding=provider_embedding,
            collection_name=collection_names[0] if collection_names else request_body.collection_name,
            collection_names=collection_names,
            chatbot_id=chatbot_id,
            chatbot_instructions=chatbot_instructions,
            faq_block=faq_block,
            tts_voice_enabled=tts_voice_enabled,
            tts_voice_name=tts_voice_name,
        )

        # Create StreamAgentService with dynamic configuration per request
        stream_agent_service = StreamAgentService(
            settings=settings,
            provider_llm=provider_llm,
            provider_storage=request_body.provider_storage,
            provider_embedding=provider_embedding,
            collection_names=collection_names,
            chatbot_instructions=chatbot_instructions,
            faq_block=faq_block,
        )

        logger.info(
            f'Starting streaming agent for user {user_id} with providers: '
            f'llm={provider_llm}, storage={request_body.provider_storage}, '
            f'embedding={provider_embedding}, collections={collection_names}, '
            f'chatbot_id={chatbot_id}',
        )

        # Wrap the stream generator to handle disconnections gracefully
        async def wrapped_stream():
            try:
                async for event in stream_agent_service.process(stream_agent_input, db_session_factory):
                    yield event
            except asyncio.CancelledError:
                # Client disconnected - this is normal for SSE streams
                logger.info(
                    f"Client disconnected during stream for user {user_id}",
                    extra={'user_id': str(user_id)},
                )
                raise  # Must re-raise to allow proper async cleanup
            except Exception as stream_error:
                # Log but don't propagate - connection is likely already closed
                logger.warning(
                    f"Stream interrupted for user {user_id}: {stream_error}",
                    extra={'error_type': type(stream_error).__name__},
                )

        return EventSourceResponse(
            wrapped_stream(),
            ping=15,  # Send ping every 15 seconds to keep connection alive
            ping_message_factory=lambda: dict(comment='keepalive'),
        )

    except Exception as e:
        logger.error(f'Error creating EventSourceResponse: {e}', exc_info=True)
        return exception_handler.handle_exception(
            e='Failed to create streaming response',
            extra={
                'user_id': str(user_id),
                'error': str(e),
            },
        )
