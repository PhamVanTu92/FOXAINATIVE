"""Temporary Facebook Messenger service.

This module is isolated from the main project flow:
- Uses TMP_FACEBOOK__* environment variables only
- Uses LangGraph agent with Gemini
- Keeps per-user memory in RAM only (MemorySaver)
- Does not use DB conversation/message services
- Does not use Mem0
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional
from uuid import UUID, NAMESPACE_URL, uuid5

import httpx
from joint.base import BaseModel, BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from langchain_core.messages import AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from pydantic import Field
from pydantic import PrivateAttr

logger = get_logger(__name__)

GRAPH_API_BASE = 'https://graph.facebook.com'
FACEBOOK_MAX_MESSAGE_LENGTH = 2000
DEFAULT_AGENT_TIMEOUT_SECONDS = 90
MAX_PROCESSED_MESSAGE_IDS = 5000
DEDUP_WINDOW_SECONDS = 600


def _clean_env(value: Optional[str], default: str = '') -> str:
    """Normalize env values and strip optional quotes."""
    if value is None:
        return default
    return value.strip().strip('"').strip("'")


class TmpFacebookSettings(BaseModel):
    """Temporary Facebook config loaded from TMP_FACEBOOK__* variables."""

    page_access_token: str = Field(default='')
    verify_token: str = Field(default='my_verify_token_123')
    app_secret: str = Field(default='')
    app_id: str = Field(default='')
    api_version: str = Field(default='v25.0')

    @classmethod
    def from_env(cls) -> 'TmpFacebookSettings':
        return cls(
            page_access_token=_clean_env(os.getenv('TMP_FACEBOOK__PAGE_ACCESS_TOKEN')),
            verify_token=_clean_env(os.getenv('TMP_FACEBOOK__VERIFY_TOKEN'), 'my_verify_token_123'),
            app_secret=_clean_env(os.getenv('TMP_FACEBOOK__APP_SECRET')),
            app_id=_clean_env(os.getenv('TMP_FACEBOOK__APP_ID')),
            api_version=_clean_env(os.getenv('TMP_FACEBOOK__API_VERSION'), 'v25.0'),
        )


class FacebookIncomingMessage(BaseModel):
    """Normalized incoming Facebook message."""

    sender_id: str = Field(..., description='Sender PSID.')
    message_text: str = Field(..., description='Message text.')
    message_id: str = Field(default='', description='Facebook message ID.')
    timestamp: Optional[int] = Field(None, description='Event timestamp.')
    is_postback: bool = Field(default=False, description='Message came from postback.')


class FacebookWebhookPayload(BaseModel):
    """Parsed webhook payload."""

    messages: List[FacebookIncomingMessage] = Field(default_factory=list)
    is_valid: bool = Field(default=False)


class FacebookTmpService(BaseService):
    """Temporary Facebook service with LangGraph + Gemini runtime memory only."""

    settings: Settings

    _tmp_settings: TmpFacebookSettings = PrivateAttr()
    _agent_graph: Any = PrivateAttr(default=None)
    _agent_timeout_seconds: int = PrivateAttr(default=DEFAULT_AGENT_TIMEOUT_SECONDS)
    _processed_message_ids: OrderedDict[str, float] = PrivateAttr(default_factory=OrderedDict)

    class Config:
        arbitrary_types_allowed = True

    def model_post_init(self, __context: Any) -> None:
        object.__setattr__(self, '_tmp_settings', TmpFacebookSettings.from_env())

        timeout_raw = _clean_env(os.getenv('TMP_FACEBOOK__AGENT_TIMEOUT_SECONDS'))
        timeout_seconds = DEFAULT_AGENT_TIMEOUT_SECONDS
        if timeout_raw:
            try:
                timeout_seconds = max(10, int(float(timeout_raw)))
            except ValueError:
                logger.warning(
                    'Invalid TMP_FACEBOOK__AGENT_TIMEOUT_SECONDS, using default',
                    extra={
                        'value': timeout_raw,
                        'default': DEFAULT_AGENT_TIMEOUT_SECONDS,
                    },
                )

        object.__setattr__(self, '_agent_timeout_seconds', timeout_seconds)
        object.__setattr__(self, '_agent_graph', self._build_agent_graph())

        logger.info(
            'Facebook TMP service initialized',
            extra={
                'api_version': self._tmp_settings.api_version,
                'verify_token_set': bool(self._tmp_settings.verify_token),
                'app_secret_set': bool(self._tmp_settings.app_secret),
                'page_token_set': bool(self._tmp_settings.page_access_token),
                'timeout_seconds': self._agent_timeout_seconds,
            },
        )

    def process(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError('Use async methods directly.')

    def _build_agent_graph(self):
        """Create a simple LangGraph agent without custom nodes."""
        if not self.settings.gemini.api_key:
            logger.warning('GEMINI__API_KEY not set — FacebookTmpService agent graph disabled')
            return None

        model_name = _clean_env(
            os.getenv('TMP_FACEBOOK__GEMINI_MODEL_NAME'),
            self.settings.gemini.model_name,
        )

        llm = ChatGoogleGenerativeAI(
            google_api_key=self.settings.gemini.api_key,
            model=model_name,
            temperature=self.settings.gemini.temperature,
            timeout=self.settings.gemini.request_timeout,
            max_retries=self.settings.gemini.max_retries,
            max_output_tokens=self.settings.gemini.max_output_tokens,
        )

        system_prompt = """
    # VAI TRÒ (ROLE)
Bạn là Trợ lý ảo Chăm sóc khách hàng của **Home Care** - Công ty TNHH Chăm Sóc Mẹ Và Bé Tại Nhà Home Care. 
Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc của khách hàng về các dịch vụ, sản phẩm và chính sách của Home Care.

# GIỌNG ĐIỆU (TONE & STYLE)
- Chuyên nghiệp, ân cần, nhẹ nhàng và thấu cảm (phù hợp với đối tượng khách hàng là mẹ bầu và phụ nữ sau sinh).
- Xưng hô là "Home Care" hoặc "em" và gọi người dùng là "ba/mẹ", "anh/chị" hoặc "Quý khách".
- Luôn giữ thái độ lịch sự, sẵn sàng giúp đỡ.

# NGUYÊN TẮC HOẠT ĐỘNG (GUIDELINES)
1. BÁM SÁT NGỮ CẢNH: Chỉ sử dụng thông tin được cung cấp trong phần [NGỮ CẢNH CỦA HOME CARE] bên dưới để trả lời. TUYỆT ĐỐI KHÔNG tự bịa đặt (hallucinate), suy đoán hoặc lấy thông tin từ nguồn bên ngoài.
2. XỬ LÝ KHI THIẾU THÔNG TIN: Nếu câu hỏi của khách hàng không có câu trả lời trong ngữ cảnh được cung cấp, hãy lịch sự xin lỗi và hướng dẫn họ liên hệ qua Tổng đài 1900 0387 hoặc Hotline 0973 871 376 / 0962 131 515 để được hỗ trợ chi tiết.
3. NGẮN GỌN & RÕ RÀNG: Trả lời đúng trọng tâm câu hỏi. Trình bày dễ đọc, sử dụng gạch đầu dòng (bullet points) khi cần liệt kê nhiều dịch vụ hoặc sản phẩm.
4. GIAO TIẾP TỰ NHIÊN: Đừng chỉ copy-paste nguyên văn câu trả lời từ ngữ cảnh. Hãy diễn đạt lại một cách tự nhiên, mềm mại như một người tư vấn thật đang nói chuyện.

# NGỮ CẢNH CỦA HOME CARE (CONTEXT)
STT	Câu hỏi	Trả lời
1	Home Care cung cấp dịch vụ gì?	Home Care cung cấp các dịch vụ chăm sóc mẹ và bé tại nhà, đồng hành từ thai kỳ đến giai đoạn hồi phục sau sinh.
2	Thông điệp chính của Home Care là gì?	Home Care nhấn mạnh việc chăm sóc mẹ và bé trọn vẹn, không chỉ là dịch vụ mà còn là sự đồng hành ấm áp trong giai đoạn quan trọng của cuộc đời người mẹ.
3	Home Care có dịch vụ massage bầu tại nhà không?	Có. Một trong các dịch vụ nổi bật của Home Care là massage bầu tại nhà.
4	Home Care có dịch vụ chăm sóc sau sinh không?	Có. Home Care cung cấp dịch vụ chăm sóc sau sinh dành cho mẹ và bé.
5	Home Care có dịch vụ tắm và massage cho bé không?	Có. Home Care có dịch vụ tắm và massage cho bé tại nhà.
6	Home Care có hỗ trợ thông tắc sữa không?	Có. Home Care cung cấp dịch vụ thông tắc sữa tại nhà.
7	Home Care có dịch vụ giảm eo sau sinh không?	Có. Giảm eo sau sinh là một trong những dịch vụ được giới thiệu trên trang.
8	Home Care có chăm sóc rốn bé không?	Có. Home Care cung cấp dịch vụ chăm sóc rốn bé.
9	Home Care có chăm sóc vết mổ sau sinh không?	Có. Home Care có dịch vụ chăm sóc vết mổ cho mẹ sau sinh.
10	Home Care phục vụ tại đâu?	Home Care là đơn vị cung cấp dịch vụ chăm sóc tại nhà cho mẹ và bé.
11	Khách hàng có thể đặt lịch chăm sóc với Home Care bằng cách nào?	Khách hàng có thể nhận tư vấn và đặt lịch chăm sóc tại nhà ngay thông qua tổng đài, hotline hoặc email của Home Care.
12	Số tổng đài hỗ trợ của Home Care là gì?	Tổng đài hỗ trợ của Home Care là 1900 0387.
13	Hotline của Home Care là số nào?	Home Care cung cấp hai số hotline là 0973 871 376 và 0962 131 515.
14	Email liên hệ của Home Care là gì?	Email liên hệ của Home Care là cskh@homegroups.vn.
15	Địa chỉ của Home Care ở đâu?	Địa chỉ được ghi trên trang là 20 Huy Du, Phường Từ Liêm, TP Hà Nội, Việt Nam.
16	Tên đầy đủ của doanh nghiệp Home Care là gì?	Tên doanh nghiệp là Công ty TNHH Chăm Sóc Mẹ Và Bé Tại Nhà Home Care.
17	Home Care có những nhóm dịch vụ chính nào cho mẹ?	Các nhóm dịch vụ chính cho mẹ gồm: massage bầu tại nhà, chăm sóc sau sinh, thông tắc sữa, giảm eo sau sinh, chăm sóc vết mổ.
18	Home Care có những dịch vụ nào dành cho bé?	Các dịch vụ dành cho bé gồm: tắm và massage cho bé, chăm sóc rốn bé.
19	Home Care có hỗ trợ tư vấn miễn phí không?	Có. Trên trang có nội dung nhận tư vấn 1:1 miễn phí cho khách hàng.
20	Home Care có quà tặng miễn phí nào cho mẹ không?	Có. Trang web giới thiệu quà tặng miễn phí gồm video massage và tắm bé không khóc, cùng hướng dẫn chăm sóc da và rốn cho bé từ chuyên gia.
21	Cửa hàng của Home Care là gì?	Cửa hàng của Home Care là showroom online cung cấp các sản phẩm dành cho mẹ, bé và gia đình.
22	Trang cửa hàng của Home Care hiện có bao nhiêu sản phẩm?	Trang hiển thị tổng cộng 81 kết quả sản phẩm.
24	Cửa hàng Home Care có những nhóm sản phẩm nào?	Trang cửa hàng có các nhóm như Chăm Sóc Bé Yêu, Chăm Sóc Da Mặt, Giảm Eo Sau Sinh, Chăm sóc mẹ bầu, Chăm Sóc Da Body, Lợi Sữa và các sản phẩm hỗ trợ giảm đau nhức mỏi.
25	Home Care có bán sản phẩm cho bé bị hăm tã và rôm sảy không?	Có. Một sản phẩm trên trang là Kem Da Bon Bon Plus+ Xoa Dịu Hăm Tã, Rôm Sảy Cho Bé 0M+, giá 140.000 đồng.
26	Home Care có sản phẩm hỗ trợ viêm da cơ địa cho bé không?	Có. Cửa hàng có sản phẩm Kem Bôi Viêm Da Cơ Địa Cho Bé Bon Bon, giá 140.000 đồng.
27	Home Care có bán thảo dược tắm bé không?	Có. Sản phẩm [Mini] Thảo Dược Tắm Bé: Giảm Rôm Sảy, Hăm Da, Mẩn Ngứa đang được bán với giá 35.000 đồng.
28	Home Care có sản phẩm dành cho mẹ bầu và mẹ sau sinh chăm sóc da không?	Có. Ví dụ, Mặt Nạ Nghệ Cho Mẹ Bầu và Sau Sinh – Cấp Ẩm Sâu, Đều Màu Da, Giảm Sạm Nám có giá 70.000 đồng.
29	Home Care có sản phẩm hỗ trợ giảm eo sau sinh không?	Có. Trang cửa hàng có các sản phẩm như [Mini] Dầu Massage Tan Mỡ Bụng Sau Sinh giá 90.000 đồng, [Mini] Muối Chườm Bụng Sau Sinh giá 80.000 đồng, và [Mini] Kem Tan Mỡ Giảm Eo Sau Sinh giá 70.000 đồng.
30	Home Care có các chính sách nào cho khách mua hàng?	Trang cửa hàng liệt kê các chính sách gồm chính sách mua hàng, thanh toán, đổi trả, vận chuyển, bảo hành và bảo mật.

        
"""

        return create_react_agent(
            model=llm,
            tools=[],
            prompt=system_prompt,
            checkpointer=MemorySaver(),
        )

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify X-Hub-Signature-256 from Facebook."""
        app_secret = self._tmp_settings.app_secret
        if not app_secret:
            logger.warning('TMP Facebook app_secret not set, skipping signature verification')
            return True
        if not signature:
            logger.warning('Missing X-Hub-Signature-256 header, allowing in tmp mode')
            return True

        if not signature.startswith('sha256='):
            logger.error(f'Invalid signature format: {signature}')
            return False

        expected = hmac.new(app_secret.encode(), payload, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(f'sha256={expected}', signature)
        if not is_valid:
            logger.error('Facebook webhook signature mismatch')
        return is_valid

    def verify_webhook_token(self, received_token: str) -> bool:
        """Verify webhook token from Facebook subscribe check."""
        expected_token = self._tmp_settings.verify_token
        if not expected_token:
            return False
        return hmac.compare_digest(expected_token, received_token)

    @staticmethod
    def parse_payload(body: Dict[str, Any]) -> FacebookWebhookPayload:
        """Parse incoming Facebook webhook payload into normalized messages."""
        messages: List[FacebookIncomingMessage] = []

        if body.get('object') != 'page':
            return FacebookWebhookPayload(messages=[], is_valid=False)

        for entry in body.get('entry', []):
            for event in entry.get('messaging', []):
                sender_id = event.get('sender', {}).get('id', '')
                if not sender_id:
                    continue

                timestamp = event.get('timestamp')
                message = event.get('message', {})
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

                postback = event.get('postback', {})
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

    @staticmethod
    def generate_user_id(sender_id: str) -> UUID:
        """Generate stable user id from sender PSID."""
        return uuid5(NAMESPACE_URL, f'facebook-tmp-user:{sender_id}')

    async def send_text_message(self, to: str, text: str) -> bool:
        """Send text through Facebook Graph API."""
        fb = self._tmp_settings
        if not fb.page_access_token:
            logger.error('TMP Facebook page_access_token missing')
            return False

        url = f'{GRAPH_API_BASE}/{fb.api_version}/me/messages'
        headers = {'Content-Type': 'application/json'}
        params = {'access_token': fb.page_access_token}

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
                            f'Facebook API error: {resp.status_code} - {resp.text}',
                            extra={'to': to, 'status': resp.status_code},
                        )
                        success = False
                except Exception as e:
                    logger.error(f'Failed to send Facebook message: {e}', extra={'to': to})
                    success = False

        return success

    async def send_typing_indicator(self, to: str, action: str = 'typing_on') -> bool:
        """Send typing indicator to messenger user."""
        fb = self._tmp_settings
        if not fb.page_access_token:
            return False

        url = f'{GRAPH_API_BASE}/{fb.api_version}/me/messages'
        params = {'access_token': fb.page_access_token}
        payload = {
            'recipient': {'id': to},
            'sender_action': action,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, params=params, json=payload)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f'Error sending typing indicator: {e}')
            return False

    async def handle_message(self, message: FacebookIncomingMessage) -> None:
        """Handle one incoming message in background with tmp runtime only."""
        user_id = self.generate_user_id(message.sender_id)

        if message.message_id and self._is_duplicate_message(message.message_id):
            logger.info(
                'Skipping duplicate Facebook message',
                extra={
                    'sender_id': message.sender_id[:8] + '***',
                    'message_id': message.message_id,
                },
            )
            return

        if message.message_id:
            self._mark_message_processed(message.message_id)

        logger.info(
            'Processing Facebook TMP message',
            extra={
                'user_id': str(user_id),
                'message_id': message.message_id,
                'message_length': len(message.message_text),
                'is_postback': message.is_postback,
            },
        )

        try:
            await self.send_typing_indicator(message.sender_id, 'typing_on')

            full_response = await self._run_agent(
                sender_id=message.sender_id,
                message_text=message.message_text,
            )

            await self.send_typing_indicator(message.sender_id, 'typing_off')

            if full_response:
                await self.send_text_message(message.sender_id, full_response)
            else:
                await self.send_text_message(
                    message.sender_id,
                    'Sorry, I cannot process your message at the moment. Please try again later.',
                )
        except Exception as e:
            logger.error(
                f'Error processing Facebook TMP message: {e}',
                extra={'user_id': str(user_id), 'message_id': message.message_id},
                exc_info=True,
            )
            try:
                await self.send_typing_indicator(message.sender_id, 'typing_off')
                await self.send_text_message(
                    message.sender_id,
                    'Sorry, an error occurred while processing your message. Please try again later.',
                )
            except Exception:
                logger.error('Failed to send error message to Facebook', exc_info=True)

    async def _run_agent(self, sender_id: str, message_text: str) -> str:
        """Invoke LangGraph agent with per-user in-process memory thread."""
        thread_id = f'facebook-tmp:{self.generate_user_id(sender_id)}'
        config = {'configurable': {'thread_id': thread_id}}

        try:
            result = await asyncio.wait_for(
                self._agent_graph.ainvoke(
                    {'messages': [('user', message_text)]},
                    config=config,
                ),
                timeout=self._agent_timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.error(
                'TMP Facebook agent timed out',
                extra={
                    'thread_id': thread_id,
                    'timeout_seconds': self._agent_timeout_seconds,
                },
            )
            return ''
        except Exception as e:
            logger.error(
                f'TMP Facebook agent invoke failed: {e}',
                extra={'thread_id': thread_id},
                exc_info=True,
            )
            return ''

        if not isinstance(result, dict):
            return ''

        messages = result.get('messages', [])
        for msg in reversed(messages):
            if isinstance(msg, AIMessage):
                text = self._extract_text(msg.content)
                if text:
                    return text.strip()

        return ''

    @staticmethod
    def _extract_text(content: Any) -> str:
        """Extract text from model output content blocks."""
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, str):
                    if item.strip():
                        parts.append(item)
                    continue

                if isinstance(item, dict):
                    text_value = item.get('text')
                    if isinstance(text_value, str) and text_value.strip():
                        parts.append(text_value)
            return '\n'.join(parts).strip()

        return str(content or '').strip()

    def _mark_message_processed(self, message_id: str) -> None:
        """Remember processed message ids to avoid duplicate replies."""
        now = time.time()
        self._processed_message_ids[message_id] = now
        self._processed_message_ids.move_to_end(message_id)

        while len(self._processed_message_ids) > MAX_PROCESSED_MESSAGE_IDS:
            self._processed_message_ids.popitem(last=False)

    def _is_duplicate_message(self, message_id: str) -> bool:
        """Check if message id was seen recently."""
        timestamp = self._processed_message_ids.get(message_id)
        if timestamp is None:
            return False
        return (time.time() - timestamp) <= DEDUP_WINDOW_SECONDS

    @staticmethod
    def _split_message(text: str, max_length: int = FACEBOOK_MAX_MESSAGE_LENGTH) -> List[str]:
        """Split long messages to respect messenger max length."""
        if len(text) <= max_length:
            return [text]

        chunks: List[str] = []
        remaining = text
        while remaining:
            if len(remaining) <= max_length:
                chunks.append(remaining)
                break

            split_pos = remaining.rfind('\n', 0, max_length)
            if split_pos == -1 or split_pos < max_length // 2:
                split_pos = remaining.rfind(' ', 0, max_length)
            if split_pos == -1:
                split_pos = max_length

            chunks.append(remaining[:split_pos])
            remaining = remaining[split_pos:].lstrip()

        return chunks
