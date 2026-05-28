"""WhatsApp Business Cloud API integration service.

Handles webhook verification, message parsing, reply sending,
and background processing of incoming WhatsApp messages
through the existing StreamAgentService pipeline.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID, uuid5, NAMESPACE_URL

import httpx
from joint.base import BaseModel, BaseService
from joint.logging import get_logger
from joint.settings.defaults import (
    DEFAULT_COLLECTION,
    DEFAULT_EMBEDDING_PROVIDER,
    DEFAULT_LLM_PROVIDER,
    DEFAULT_STORAGE_PROVIDER,
)
from joint.settings.settings import Settings
from pydantic import Field

from app.orchestrator.agentic import StreamAgentInput, StreamAgentService

logger = get_logger(__name__)

# WhatsApp message length limit (UTF-16 characters)
WHATSAPP_MAX_MESSAGE_LENGTH = 4096
# Graph API base URL
GRAPH_API_BASE = 'https://graph.facebook.com'


# ============================================================================
# Models
# ============================================================================

class WhatsAppIncomingMessage(BaseModel):
    """Parsed incoming WhatsApp message."""

    phone_number: str = Field(..., description='Sender phone number (without +).')
    message_text: str = Field(..., description='Message body text.')
    message_id: str = Field(default='', description='WhatsApp message ID.')
    timestamp: str = Field(default='', description='Message timestamp.')
    display_name: Optional[str] = Field(None, description='Sender display name.')


class WhatsAppWebhookPayload(BaseModel):
    """Validated webhook payload from Meta."""

    messages: List[WhatsAppIncomingMessage] = Field(default_factory=list)
    is_valid: bool = Field(default=False)


# ============================================================================
# Service
# ============================================================================

class WhatsAppService(BaseService):
    """Service for WhatsApp Business Cloud API integration.

    Handles signature verification, payload parsing, message processing
    via StreamAgentService, and reply delivery through Graph API.
    """

    settings: Settings

    def process(self, *args: Any, **kwargs: Any) -> Any:
        """Not used — all operations are async."""
        raise NotImplementedError('Use async methods directly.')

    # ── Signature verification ──────────────────────────────────────────

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify X-Hub-Signature-256 from Meta webhook.

        Args:
            payload: Raw request body bytes.
            signature: Value of X-Hub-Signature-256 header.

        Returns:
            True if signature is valid or app_secret is not configured.
        """
        app_secret = self.settings.whatsapp.app_secret
        if not app_secret:
            logger.warning('WhatsApp app_secret not configured — skipping signature verification')
            return True
        if not signature:
            logger.warning('No X-Hub-Signature-256 header — allowing (dev mode)')
            return True

        expected = hmac.new(
            app_secret.encode(), payload, hashlib.sha256,
        ).hexdigest()
        is_valid = hmac.compare_digest(f'sha256={expected}', signature)
        if not is_valid:
            logger.error('WhatsApp webhook signature mismatch')
        return is_valid

    # ── Payload parsing ─────────────────────────────────────────────────

    @staticmethod
    def parse_payload(body: Dict[str, Any]) -> WhatsAppWebhookPayload:
        """Extract text messages from Meta webhook payload.

        Args:
            body: Parsed JSON body from webhook POST request.

        Returns:
            WhatsAppWebhookPayload with extracted messages.
        """
        messages: List[WhatsAppIncomingMessage] = []

        if body.get('object') != 'whatsapp_business_account':
            return WhatsAppWebhookPayload(messages=[], is_valid=False)

        for entry in body.get('entry', []):
            for change in entry.get('changes', []):
                value = change.get('value', {})
                contacts = {
                    c.get('wa_id', ''): c.get('profile', {}).get('name')
                    for c in value.get('contacts', [])
                }
                for msg in value.get('messages', []):
                    if msg.get('type') != 'text':
                        continue
                    phone = msg.get('from', '')
                    messages.append(
                        WhatsAppIncomingMessage(
                            phone_number=phone,
                            message_text=msg.get('text', {}).get('body', ''),
                            message_id=msg.get('id', ''),
                            timestamp=msg.get('timestamp', ''),
                            display_name=contacts.get(phone),
                        ),
                    )

        return WhatsAppWebhookPayload(messages=messages, is_valid=True)

    # ── User ID generation ──────────────────────────────────────────────

    @staticmethod
    def generate_user_id(phone_number: str) -> UUID:
        """Generate deterministic user_id from phone number.

        Uses UUID v5 (SHA-1 name-based) for consistency across restarts.

        Args:
            phone_number: WhatsApp phone number string.

        Returns:
            Deterministic UUID for the phone number.
        """
        return uuid5(NAMESPACE_URL, f'whatsapp-user:{phone_number}')

    # ── Send reply via Graph API ────────────────────────────────────────

    async def send_text_message(self, to: str, text: str) -> bool:
        """Send a text message via WhatsApp Business Cloud API.

        Automatically splits messages exceeding the 4096-char limit.

        Args:
            to: Recipient phone number.
            text: Message text to send.

        Returns:
            True if all message parts were sent successfully.
        """
        ws = self.settings.whatsapp
        url = f'{GRAPH_API_BASE}/{ws.api_version}/{ws.phone_number_id}/messages'
        headers = {
            'Authorization': f'Bearer {ws.access_token}',
            'Content-Type': 'application/json',
        }

        chunks = self._split_message(text)
        success = True

        async with httpx.AsyncClient(timeout=30) as client:
            for chunk in chunks:
                payload = {
                    'messaging_product': 'whatsapp',
                    'to': to,
                    'type': 'text',
                    'text': {'body': chunk},
                }
                try:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code != 200:
                        logger.error(
                            f'WhatsApp API error: {resp.status_code} — {resp.text}',
                            extra={'to': to, 'status': resp.status_code},
                        )
                        success = False
                    else:
                        logger.debug(f'WhatsApp message sent to {to}')
                except Exception as e:
                    logger.error(f'Failed to send WhatsApp message: {e}', extra={'to': to})
                    success = False

        return success

    # ── Background message processing ───────────────────────────────────

    async def handle_message(
        self, message: WhatsAppIncomingMessage, db_session_factory: Callable | None = None,
    ) -> None:
        """Process a single incoming message in background.

        Generates a user_id from the phone number, invokes StreamAgentService
        to get the full AI response, then sends the reply via WhatsApp API.

        Args:
            message: Parsed incoming WhatsApp message.
            db_session_factory: Callable returning a context-manager session.
        """
        user_id = self.generate_user_id(message.phone_number)

        logger.info(
            f'Processing WhatsApp message from {message.phone_number[:6]}***',
            extra={
                'user_id': str(user_id),
                'message_id': message.message_id,
                'message_length': len(message.message_text),
            },
        )

        try:
            stream_input = StreamAgentInput(
                user_id=user_id,
                message=message.message_text,
                conversation_id=None,  # Auto-create conversation
                provider_llm=DEFAULT_LLM_PROVIDER,
                provider_storage=DEFAULT_STORAGE_PROVIDER,
                provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
                collection_name=DEFAULT_COLLECTION,
            )

            stream_service = StreamAgentService(
                settings=self.settings,
                provider_llm=DEFAULT_LLM_PROVIDER,
                provider_storage=DEFAULT_STORAGE_PROVIDER,
                provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
                collection_name=DEFAULT_COLLECTION,
            )

            # Collect full response from SSE stream
            full_response = await self._collect_response(stream_service, stream_input, db_session_factory)

            if full_response:
                await self.send_text_message(message.phone_number, full_response)
            else:
                await self.send_text_message(
                    message.phone_number,
                    'Xin lỗi, tôi không thể xử lý tin nhắn của bạn lúc này. Vui lòng thử lại sau.',
                )

        except Exception as e:
            logger.error(
                f'Error processing WhatsApp message: {e}',
                extra={'user_id': str(user_id), 'message_id': message.message_id},
                exc_info=True,
            )
            try:
                await self.send_text_message(
                    message.phone_number,
                    'Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.',
                )
            except Exception:
                logger.error('Failed to send error reply to WhatsApp', exc_info=True)

    # ── Internal helpers ────────────────────────────────────────────────

    @staticmethod
    async def _collect_response(
        service: StreamAgentService,
        input_data: StreamAgentInput,
        db_session_factory: Callable | None = None,
    ) -> str:
        """Collect full text response from StreamAgentService SSE stream.

        Mirrors the pattern used in agentic_public.public_chat endpoint.

        Args:
            service: Initialized StreamAgentService.
            input_data: Agent input with user message and metadata.
            db_session_factory: Callable returning a context-manager session.

        Returns:
            Concatenated response text.
        """
        full_response = ''
        async for event in service.process(input_data, db_session_factory):
            if not hasattr(event, 'data'):
                continue
            try:
                event_data = json.loads(event.data)
                if event_data.get('type') == 'message_chunk':
                    content = event_data.get('content', '')
                    if content:
                        full_response += content
            except (json.JSONDecodeError, AttributeError):
                continue

        return full_response.strip()

    @staticmethod
    def _split_message(text: str, max_length: int = WHATSAPP_MAX_MESSAGE_LENGTH) -> List[str]:
        """Split a long message into chunks respecting WhatsApp limits.

        Tries to split on newline boundaries; falls back to hard split.

        Args:
            text: Message text to split.
            max_length: Maximum characters per chunk.

        Returns:
            List of message chunks.
        """
        if len(text) <= max_length:
            return [text]

        chunks: List[str] = []
        while text:
            if len(text) <= max_length:
                chunks.append(text)
                break
            # Try to split at last newline within limit
            split_pos = text.rfind('\n', 0, max_length)
            if split_pos == -1 or split_pos < max_length // 2:
                # Fall back to space boundary
                split_pos = text.rfind(' ', 0, max_length)
            if split_pos == -1:
                split_pos = max_length
            chunks.append(text[:split_pos])
            text = text[split_pos:].lstrip()

        return chunks
