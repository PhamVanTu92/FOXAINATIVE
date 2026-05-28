"""
Public Orchestrator API Router - No authentication required.

Allows public access to AI chat functionality using client-provided identifiers.
Suitable for mobile apps, third-party integrations, and public access scenarios.
"""
from __future__ import annotations

import asyncio
from typing import Dict, Optional
from uuid import UUID, uuid5, NAMESPACE_URL

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from api.helpers.chatbot_resolver import resolve_chatbot
from api.helpers.dependencies.database import (
    get_async_db_session_factory,
    get_db_session,
)
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.validators import (
    validate_user_input_length,
    MAX_USER_INPUT_TOKENS,
    MAX_USER_INPUT_CHARS,
)
from app.orchestrator.agentic import StreamAgentInput, StreamAgentService
from joint.logging import get_logger
from joint.settings.defaults import (
    DEFAULT_COLLECTION,
    DEFAULT_EMBEDDING_PROVIDER,
    DEFAULT_LLM_PROVIDER,
    DEFAULT_STORAGE_PROVIDER,
)
from joint.utils import get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class PublicChatRequest(BaseModel):
    """Public chat request model."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="User message"
    )
    client_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Unique client identifier (stable across sessions)"
    )
    conversation_id: Optional[UUID] = Field(
        None,
        description="Conversation ID for continuing chat"
    )
    session_info: Optional[Dict[str, str]] = Field(
        None,
        description="Optional metadata (user_agent, platform, etc.)"
    )
    provider_llm: str = Field(
        default=DEFAULT_LLM_PROVIDER,
        description="LLM provider"
    )
    provider_storage: str = Field(
        default=DEFAULT_STORAGE_PROVIDER,
        description="Vector storage provider"
    )
    provider_embedding: str = Field(
        default=DEFAULT_EMBEDDING_PROVIDER,
        description="Embedding provider"
    )
    collection_name: str = Field(
        default=DEFAULT_COLLECTION,
        description="Collection name for RAG"
    )
    # foxai-native: when present, server loads chatbot config by public_id
    # (rotatable embed token) and overrides providers/collections/prompt.
    # Conversation rows are tagged with chatbot_id and user_id is left NULL.
    public_id: Optional[UUID] = Field(
        None,
        description="Public chatbot id (rotatable embed token).",
    )


# ============================================================================
# Utility Functions
# ============================================================================

def generate_user_id_from_client_id(client_id: str) -> UUID:
    """
    Generate deterministic user_id from client_id.
    
    Uses UUID v5 (name-based with SHA-1) to ensure same client_id
    always produces same user_id.
    
    Args:
        client_id: Client-provided identifier.
        
    Returns:
        UUID: Deterministic user ID.
    """
    # Use NAMESPACE_URL as namespace for UUID v5
    # This ensures consistent UUIDs across deployments
    user_id = uuid5(NAMESPACE_URL, f"foxai-public-client:{client_id}")
    return user_id


def validate_client_id(client_id: str) -> bool:
    """
    Validate client_id format.
    
    Args:
        client_id: Client identifier to validate.
        
    Returns:
        bool: True if valid.
    """
    if not client_id or len(client_id) < 1 or len(client_id) > 255:
        return False
    
    # Basic sanitization - no control characters
    if any(ord(c) < 32 for c in client_id):
        return False
    
    return True


# ============================================================================
# Public API Endpoints
# ============================================================================

@router.post(
    '/chat/public',
    summary="Public AI Chat (No Authentication, Non-streaming)",
    description="Public non-streaming endpoint for AI chat. Returns full response at once.",
    response_model=dict,
)
async def public_chat(
    request: Request,
    request_body: PublicChatRequest = Body(...),
    db_session_factory=Depends(get_async_db_session_factory),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Public AI chat endpoint with full response (non-streaming).
    
    No authentication required - uses client_id for user identification.
    
    Request Body: Same as streaming endpoint
    
    Response:
    ```json
    {
      "status": "success",
      "conversation_id": "uuid-here",
      "response": "Full AI response text here"
    }
    ```
    
    Security:
    - Input validation and sanitization
    - Each client_id isolated to own conversations
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(),
        service_name=__name__,
    )
    
    # Validate client_id format
    if not validate_client_id(request_body.client_id):
        return exception_handler.handle_bad_request(
            message='Invalid client_id format',
            extra={'field': 'client_id'},
        )
    
    # Generate user_id from client_id
    try:
        user_id = generate_user_id_from_client_id(request_body.client_id)
    except Exception as e:
        logger.error(f"Failed to generate user_id: {e}")
        return exception_handler.handle_bad_request(
            message='Failed to process client_id',
            extra={'error': str(e)},
        )
    
    # Validate message
    message = request_body.message
    
    if not message:
        return exception_handler.handle_bad_request(
            message='message is required',
            extra={'field': 'message', 'client_id': request_body.client_id},
        )
    
    if not message.strip():
        return exception_handler.handle_bad_request(
            message='message cannot be empty',
            extra={'field': 'message', 'client_id': request_body.client_id},
        )
    
    # Validate message length
    is_valid, error_message, token_count = validate_user_input_length(
        message=message,
        user_id=request_body.client_id
    )
    
    if not is_valid:
        return exception_handler.handle_bad_request(
            message=error_message,
            extra={
                'field': 'message',
                'client_id': request_body.client_id,
                'token_count': token_count,
                'max_tokens': MAX_USER_INPUT_TOKENS,
                'max_chars': MAX_USER_INPUT_CHARS,
            },
        )
    
    # Log request
    logger.info(
        f'Public API (non-streaming) request from client_id: {request_body.client_id[:16]}...',
        extra={
            'client_id': request_body.client_id,
            'user_id': str(user_id),
            'conversation_id': request_body.conversation_id,
            'message_length': len(message),
        }
    )
    
    # foxai-native: resolve chatbot overrides when public_id is set.
    overrides = None
    if request_body.public_id is not None:
        overrides = resolve_chatbot(db, public_id=request_body.public_id)
        if overrides is None:
            return exception_handler.handle_bad_request(
                message='Chatbot not found or inactive',
                extra={'public_id': str(request_body.public_id)},
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

    try:
        # Create StreamAgentInput with generated user_id
        stream_agent_input = StreamAgentInput(
            user_id=user_id,
            message=message,
            conversation_id=request_body.conversation_id,
            provider_llm=provider_llm,
            provider_storage=request_body.provider_storage,
            provider_embedding=provider_embedding,
            collection_name=collection_names[0] if collection_names else request_body.collection_name,
            collection_names=collection_names,
            chatbot_id=chatbot_id,
            chatbot_instructions=chatbot_instructions,
            faq_block=faq_block,
        )

        # Create StreamAgentService
        stream_agent_service = StreamAgentService(
            settings=settings,
            provider_llm=provider_llm,
            provider_storage=request_body.provider_storage,
            provider_embedding=provider_embedding,
            collection_names=collection_names,
            chatbot_instructions=chatbot_instructions,
            faq_block=faq_block,
        )
        
        # Collect full response from stream
        full_response = ""
        chunk_count = 0
        response_conversation_id = request_body.conversation_id
        
        async for event in stream_agent_service.process(stream_agent_input, db_session_factory):
            chunk_count += 1
            
            if hasattr(event, 'data'):
                try:
                    import json
                    event_data = json.loads(event.data)
                    
                    if event_data.get('type') == 'message_chunk':
                        content = event_data.get('content', '')
                        if content:
                            full_response += content
                    
                    # Capture conversation_id from response
                    if event_data.get('conversation_id'):
                        response_conversation_id = event_data['conversation_id']
                            
                except json.JSONDecodeError:
                    continue
        
        logger.info(
            f"Public chat completed: {len(full_response)} chars, {chunk_count} chunks",
            extra={'client_id': request_body.client_id}
        )
        
        return {
            "status": "success",
            "conversation_id": response_conversation_id,
            "response": full_response
        }
    
    except ValidationError as e:
        return exception_handler.handle_bad_request(
            message='Invalid request payload',
            extra={
                'client_id': request_body.client_id,
                'detail': str(e),
            },
        )

    except Exception as e:
        logger.error(f'Error in public chat: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat request"
        )


@router.post(
    '/chat/public/stream',
    summary="Public AI Chat with Streaming (No Authentication)",
    description="Public endpoint for AI chat. No JWT token required. Uses client_id for user identification.",
    response_model=None,
)
async def public_chat_stream(
    request: Request,
    request_body: PublicChatRequest = Body(...),
    db_session_factory=Depends(get_async_db_session_factory),
    db: Session = Depends(get_db_session),
) -> EventSourceResponse:
    """
    Public AI chat endpoint with streaming responses.
    
    No authentication required - uses client_id for user identification.
    
    Request Body:
    ```json
    {
      "message": "Your question here",
      "client_id": "your-unique-client-id",
      "conversation_id": null,
      "session_info": {
        "platform": "mobile",
        "app_version": "1.0.0"
      },
      "provider_llm": "openai",
      "provider_storage": "qdrant",
      "provider_embedding": "openai",
      "collection_name": "FOXAI"
    }
    ```
    
    Response: Server-Sent Events (SSE) stream
    
    SSE Event Types:
    - conversation_started: Initial event with conversation_id
    - message_chunk: Content fragments with conversation_id
    - message_complete: Final event with conversation_id and metadata
    - keep_alive: Periodic heartbeat with conversation_id
    
    All events include conversation_id for client-side tracking.
    
    Example Events:
    ```
    data: {"type":"conversation_started","conversation_id":"uuid-123","content":""}
    data: {"type":"message_chunk","conversation_id":"uuid-123","content":"Hello"}
    data: {"type":"message_complete","conversation_id":"uuid-123","finishReason":"stop"}
    ```
    
    Security:
    - Input validation and sanitization
    - Each client_id isolated to own conversations
    
    User ID Generation:
    - Deterministic UUID v5 from client_id
    - Same client_id → same user_id → conversation history maintained
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(),
        service_name=__name__,
    )
    
    # Validate client_id format
    if not validate_client_id(request_body.client_id):
        return exception_handler.handle_bad_request(
            message='Invalid client_id format',
            extra={'field': 'client_id'},
        )
    
    # Generate user_id from client_id
    try:
        user_id = generate_user_id_from_client_id(request_body.client_id)
    except Exception as e:
        logger.error(f"Failed to generate user_id: {e}")
        return exception_handler.handle_bad_request(
            message='Failed to process client_id',
            extra={'error': str(e)},
        )
    
    # Validate message
    message = request_body.message
    
    if not message:
        return exception_handler.handle_bad_request(
            message='message is required',
            extra={'field': 'message', 'client_id': request_body.client_id},
        )
    
    if not message.strip():
        return exception_handler.handle_bad_request(
            message='message cannot be empty',
            extra={'field': 'message', 'client_id': request_body.client_id},
        )
    
    # Validate message length
    is_valid, error_message, token_count = validate_user_input_length(
        message=message,
        user_id=request_body.client_id
    )
    
    if not is_valid:
        return exception_handler.handle_bad_request(
            message=error_message,
            extra={
                'field': 'message',
                'client_id': request_body.client_id,
                'token_count': token_count,
                'max_tokens': MAX_USER_INPUT_TOKENS,
                'max_chars': MAX_USER_INPUT_CHARS,
            },
        )
    
    # Log request with metadata
    logger.info(
        f'Public API request from client_id: {request_body.client_id[:16]}...',
        extra={
            'client_id': request_body.client_id,
            'user_id': str(user_id),
            'conversation_id': request_body.conversation_id,
            'message_length': len(message),
            'session_info': request_body.session_info,
            'client_ip': request.client.host if request.client else None,
        }
    )
    
    # foxai-native: resolve chatbot overrides when public_id is set.
    overrides = None
    if request_body.public_id is not None:
        overrides = resolve_chatbot(db, public_id=request_body.public_id)
        if overrides is None:
            return exception_handler.handle_bad_request(
                message='Chatbot not found or inactive',
                extra={'public_id': str(request_body.public_id)},
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

    try:
        # Create StreamAgentInput with generated user_id
        stream_agent_input = StreamAgentInput(
            user_id=user_id,
            message=message,
            conversation_id=request_body.conversation_id,
            provider_llm=provider_llm,
            provider_storage=request_body.provider_storage,
            provider_embedding=provider_embedding,
            collection_name=collection_names[0] if collection_names else request_body.collection_name,
            collection_names=collection_names,
            chatbot_id=chatbot_id,
            chatbot_instructions=chatbot_instructions,
            faq_block=faq_block,
        )

        # Create StreamAgentService
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
            f'Starting streaming agent for client {request_body.client_id[:16]}... with providers: '
            f'llm={request_body.provider_llm}, storage={request_body.provider_storage}, '
            f'embedding={request_body.provider_embedding}, collection={request_body.collection_name}'
        )
        
        # Wrap stream generator
        async def wrapped_stream():
            try:
                async for event in stream_agent_service.process(stream_agent_input, db_session_factory):
                    yield event
            except asyncio.CancelledError:
                logger.info(
                    f"Public API client disconnected: client_id={request_body.client_id[:16]}...",
                    extra={'client_id': request_body.client_id}
                )
                raise
            except Exception as stream_error:
                logger.warning(
                    f"Public API stream interrupted for client {request_body.client_id[:16]}...: {stream_error}",
                    extra={'error_type': type(stream_error).__name__}
                )
        
        return EventSourceResponse(
            wrapped_stream(),
            ping=15,
            ping_message_factory=lambda: dict(comment="keepalive")
        )
    
    except ValidationError as e:
        return exception_handler.handle_bad_request(
            message='Invalid request payload',
            extra={
                'client_id': request_body.client_id,
                'detail': str(e),
            },
        )

    except Exception as e:
        logger.error(f'Error creating public EventSourceResponse: {e}', exc_info=True)
        return exception_handler.handle_exception(
            e='Failed to create streaming response',
            extra={
                'client_id': request_body.client_id,
                'error': str(e),
            },
        )

