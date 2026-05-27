"""Resolve a chatbot row into a set of runtime overrides for the chat stream.

Both the authenticated (``/v1/agents/chat/stream``) and public
(``/v1/agents/public/chat/stream``) routers use this to translate a chatbot
configuration into ``StreamAgentService`` constructor arguments.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import List
from typing import Optional

from joint.logging import get_logger
from joint.postgres.database import Chatbot
from joint.postgres.database import ChatbotController
from sqlalchemy.orm import Session

logger = get_logger(__name__)

_controller = ChatbotController()


@dataclass
class ChatbotOverrides:
    chatbot: Chatbot
    collection_names: List[str]
    provider_llm: Optional[str]
    provider_embedding: Optional[str]
    chatbot_instructions: str
    faq_block: str


def _escape_braces(text: str) -> str:
    """Escape curly braces so str.format doesn't try to interpolate user content."""
    return text.replace('{', '{{').replace('}', '}}')


def _build_faq_block(faqs: Optional[List[dict]]) -> str:
    """Render the FAQ list into a single text block for prompt injection."""
    if not faqs:
        return ''
    parts: list[str] = []
    for i, faq in enumerate(faqs, start=1):
        q = (faq.get('question') or '').strip()
        a = (faq.get('answer') or '').strip()
        if not q or not a:
            continue
        parts.append(f'{i}. Q: {q}\n   A: {a}')
    return _escape_braces('\n'.join(parts))


def resolve_chatbot(
    db: Session,
    *,
    chatbot_id: Optional[uuid.UUID] = None,
    public_id: Optional[uuid.UUID] = None,
) -> Optional[ChatbotOverrides]:
    """Load a chatbot and translate its config into runtime overrides.

    Exactly one of ``chatbot_id`` / ``public_id`` should be provided.
    Returns ``None`` when the chatbot doesn't exist or is disabled.
    """
    bot: Optional[Chatbot]
    if chatbot_id is not None:
        bot = _controller.get_by_id(db, chatbot_id)
    elif public_id is not None:
        bot = _controller.get_by_public_id(db, public_id)
    else:
        return None

    if not bot or not bot.is_active:
        return None

    collection_rows = _controller.list_collections(db, bot.id)
    collection_names = [name for _, name in collection_rows]

    return ChatbotOverrides(
        chatbot=bot,
        collection_names=collection_names,
        provider_llm=bot.llm_provider,
        provider_embedding=bot.embedding_provider,
        chatbot_instructions=_escape_braces((bot.system_prompt or '').strip()),
        faq_block=_build_faq_block(bot.faqs),
    )
