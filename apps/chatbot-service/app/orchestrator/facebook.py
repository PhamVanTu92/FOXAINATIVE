"""Facebook Messenger Platform integration service.

Handles webhook verification, message parsing, reply sending,
and background processing of incoming Facebook messages
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

# Facebook message length limit
FACEBOOK_MAX_MESSAGE_LENGTH = 2000
# Graph API base URL
GRAPH_API_BASE = 'https://graph.facebook.com'


# ============================================================================
# Models
# ============================================================================

class FacebookSender(BaseModel):
    """Facebook messaging sender."""

    id: str = Field(..., description='Facebook Page-Scoped User ID (PSID).')


class FacebookRecipient(BaseModel):
    """Facebook messaging recipient."""

    id: str = Field(..., description='Facebook Page-Scoped User ID (PSID).')


class FacebookMessageContent(BaseModel):
    """Facebook message content."""

    mid: Optional[str] = Field(None, description='Message ID.')
    text: Optional[str] = Field(None, description='Message text content.')


class FacebookPostback(BaseModel):
    """Facebook postback from button clicks."""

    payload: str = Field(..., description='Postback payload string.')
    title: Optional[str] = Field(None, description='Button title that was clicked.')


class FacebookMessagingEvent(BaseModel):
    """Single messaging event from Facebook webhook."""

    sender: FacebookSender
    recipient: FacebookRecipient
    timestamp: Optional[int] = None
    message: Optional[FacebookMessageContent] = None
    postback: Optional[FacebookPostback] = None


class FacebookIncomingMessage(BaseModel):
    """Parsed incoming Facebook message (normalised)."""

    sender_id: str = Field(..., description='Sender PSID.')
    message_text: str = Field(..., description='Message text content.')
    message_id: str = Field(default='', description='Facebook message ID.')
    timestamp: Optional[int] = Field(None, description='Event timestamp.')
    is_postback: bool = Field(default=False, description='Whether this originated from a postback.')


class FacebookWebhookPayload(BaseModel):
    """Validated webhook payload from Facebook."""

    messages: List[FacebookIncomingMessage] = Field(default_factory=list)
    is_valid: bool = Field(default=False)


# ============================================================================
# Service
# ============================================================================

class FacebookService(BaseService):
    """Service for Facebook Messenger Platform integration.

    Handles signature verification, payload parsing, message processing
    via StreamAgentService, and reply delivery through Graph API.
    """

    settings: Settings

    def process(self, *args: Any, **kwargs: Any) -> Any:
        """Not used — all operations are async."""
        raise NotImplementedError('Use async methods directly.')

    # ── Signature verification ──────────────────────────────────────────

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify X-Hub-Signature-256 from Facebook webhook.

        Args:
            payload: Raw request body bytes.
            signature: Value of X-Hub-Signature-256 header.

        Returns:
            True if signature is valid or app_secret is not configured.
        """
        app_secret = self.settings.facebook.app_secret
        if not app_secret:
            logger.warning('Facebook app_secret not configured — skipping signature verification')
            return True
        if not signature:
            logger.warning('No X-Hub-Signature-256 header — allowing (dev mode)')
            return True

        if not signature.startswith('sha256='):
            logger.error(f'Invalid signature format: {signature}')
            return False

        expected = hmac.new(
            app_secret.encode(), payload, hashlib.sha256,
        ).hexdigest()
        is_valid = hmac.compare_digest(f'sha256={expected}', signature)
        if not is_valid:
            logger.error('Facebook webhook signature mismatch')
        return is_valid

    def verify_webhook_token(self, received_token: str) -> bool:
        """Verify webhook verification token from Facebook.

        Args:
            received_token: Token received in hub.verify_token parameter.

        Returns:
            True if token matches configured verify_token.
        """
        expected_token = self.settings.facebook.verify_token
        is_valid = hmac.compare_digest(expected_token, received_token)
        if not is_valid:
            logger.error('Facebook webhook verify token mismatch')
        return is_valid

    # ── Payload parsing ─────────────────────────────────────────────────

    @staticmethod
    def parse_payload(body: Dict[str, Any]) -> FacebookWebhookPayload:
        """Extract messages from Facebook webhook payload.

        Facebook Messenger webhook payload structure:
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
              "message": {"mid": "mid.xxx", "text": "Hello"}
            }]
          }]
        }
        ```

        Args:
            body: Parsed JSON body from webhook POST request.

        Returns:
            FacebookWebhookPayload with extracted messages.
        """
        messages: List[FacebookIncomingMessage] = []

        if body.get('object') != 'page':
            return FacebookWebhookPayload(messages=[], is_valid=False)

        for entry in body.get('entry', []):
            for messaging_event in entry.get('messaging', []):
                sender_id = messaging_event.get('sender', {}).get('id', '')
                timestamp = messaging_event.get('timestamp')

                if not sender_id:
                    continue

                # Process text message
                message = messaging_event.get('message', {})
                if message and message.get('text'):
                    messages.append(
                        FacebookIncomingMessage(
                            sender_id=sender_id,
                            message_text=message['text'],
                            message_id=message.get('mid', ''),
                            timestamp=timestamp,
                            is_postback=False,
                        ),
                    )
                    continue

                # Process postback (button clicks)
                postback = messaging_event.get('postback', {})
                if postback and postback.get('payload'):
                    payload_str = postback['payload']
                    title = postback.get('title', '')
                    postback_text = f'{title} (payload: {payload_str})' if title else payload_str
                    messages.append(
                        FacebookIncomingMessage(
                            sender_id=sender_id,
                            message_text=postback_text,
                            message_id='',
                            timestamp=timestamp,
                            is_postback=True,
                        ),
                    )

        return FacebookWebhookPayload(messages=messages, is_valid=True)

    # ── User ID generation ──────────────────────────────────────────────

    @staticmethod
    def generate_user_id(sender_id: str) -> UUID:
        """Generate deterministic user_id from Facebook PSID.

        Uses UUID v5 (SHA-1 name-based) for consistency across restarts.

        Args:
            sender_id: Facebook Page-Scoped User ID.

        Returns:
            Deterministic UUID for the sender.
        """
        return uuid5(NAMESPACE_URL, f'facebook-user:{sender_id}')

    # ── Send reply via Graph API ────────────────────────────────────────

    async def send_text_message(self, to: str, text: str) -> bool:
        """Send a text message via Facebook Send API.

        Automatically splits messages exceeding the 2000-char limit.

        Args:
            to: Recipient PSID.
            text: Message text to send.

        Returns:
            True if all message parts were sent successfully.
        """
        fb = self.settings.facebook
        url = f'{GRAPH_API_BASE}/{fb.api_version}/me/messages'
        headers = {
            'Content-Type': 'application/json',
        }
        params = {
            'access_token': fb.page_access_token,
        }

        chunks = self._split_message(text)
        success = True

        async with httpx.AsyncClient(timeout=30) as client:
            for chunk in chunks:
                payload = {
                    'recipient': {'id': to},
                    'message': {'text': chunk},
                }
                try:
                    resp = await client.post(url, headers=headers, params=params, json=payload)
                    if resp.status_code != 200:
                        logger.error(
                            f'Facebook API error: {resp.status_code} — {resp.text}',
                            extra={'to': to, 'status': resp.status_code},
                        )
                        success = False
                    else:
                        logger.debug(f'Facebook message sent to {to}')
                except Exception as e:
                    logger.error(f'Failed to send Facebook message: {e}', extra={'to': to})
                    success = False

        return success

    async def send_typing_indicator(self, to: str, action: str = 'typing_on') -> bool:
        """Send typing indicator to let user know bot is composing.

        Args:
            to: Recipient PSID.
            action: "typing_on" or "typing_off".

        Returns:
            True if sent successfully.
        """
        fb = self.settings.facebook
        url = f'{GRAPH_API_BASE}/{fb.api_version}/me/messages'
        params = {
            'access_token': fb.page_access_token,
        }
        payload = {
            'recipient': {'id': to},
            'sender_action': action,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, params=params, json=payload)
                success = resp.status_code == 200
                if success:
                    logger.debug(f'Typing indicator sent to {to}: {action}')
                else:
                    logger.warning(f'Failed to send typing indicator: {resp.status_code}')
                return success
        except Exception as e:
            logger.error(f'Error sending typing indicator: {e}')
            return False

    # ── Background message processing ───────────────────────────────────

    async def handle_message(
        self, message: FacebookIncomingMessage, db_session_factory: Callable | None = None,
    ) -> None:
        """Process a single incoming message in background.

        Generates a user_id from the sender PSID, invokes StreamAgentService
        to get the full AI response, then sends the reply via Facebook Send API.

        Args:
            message: Parsed incoming Facebook message.
            db_session_factory: Callable returning a context-manager session.
        """
        user_id = self.generate_user_id(message.sender_id)
        
        logger.info(
            f'Processing Facebook message from {message.sender_id[:8]}***',
            extra={
                'user_id': str(user_id),
                'message_id': message.message_id,
                'message_length': len(message.message_text),
                'is_postback': message.is_postback,
            },
        )

        try:
            # Send typing indicator
            await self.send_typing_indicator(message.sender_id, 'typing_on')

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

            # Turn off typing indicator
            await self.send_typing_indicator(message.sender_id, 'typing_off')

            if full_response:
                await self.send_text_message(message.sender_id, full_response)
            else:
                await self.send_text_message(
                    message.sender_id,
                    'Xin lỗi, tôi không thể xử lý tin nhắn của bạn lúc này. Vui lòng thử lại sau.',
                )

        except Exception as e:
            logger.error(
                f'Error processing Facebook message: {e}',
                extra={'user_id': str(user_id), 'message_id': message.message_id},
                exc_info=True,
            )
            try:
                await self.send_typing_indicator(message.sender_id, 'typing_off')
                await self.send_text_message(
                    message.sender_id,
                    'Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.',
                )
            except Exception:
                logger.error('Failed to send error reply to Facebook', exc_info=True)

    # ── Internal helpers ────────────────────────────────────────────────

    @staticmethod
    async def _collect_response(
        service: StreamAgentService,
        input_data: StreamAgentInput,
        db_session_factory: Callable | None = None,
    ) -> str:
        """Collect full text response from StreamAgentService SSE stream.

        Mirrors the pattern used in WhatsApp and agentic_public endpoints.

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
    def _split_message(text: str, max_length: int = FACEBOOK_MAX_MESSAGE_LENGTH) -> List[str]:
        """Split a long message into chunks respecting Facebook limits.

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
