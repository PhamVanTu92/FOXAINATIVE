"""Utilities for converting database messages to LangChain message format."""
from __future__ import annotations

from typing import List

from joint.logging import get_logger
from joint.postgres.database.schemas import Message
from joint.postgres.database.schemas import MessageType
from langchain_core.messages import AIMessage
from langchain_core.messages import BaseMessage
from langchain_core.messages import HumanMessage

logger = get_logger(__name__)


def convert_db_messages_to_langchain(
    db_messages: List[Message],
) -> List[BaseMessage]:
    """Convert PostgreSQL message records to LangChain message objects.

    Maps database MessageType.HUMAN/AI to HumanMessage/AIMessage respectively.
    Preserves chronological order from input. Skips unknown message types.

    Args:
        db_messages: List of Message schemas from PostgreSQL (chronological order).

    Returns:
        List of LangChain BaseMessage objects ready for graph state injection.
    """
    langchain_messages: List[BaseMessage] = []

    for msg in db_messages:
        if msg.type == MessageType.HUMAN:
            langchain_messages.append(HumanMessage(content=msg.contents))
        elif msg.type == MessageType.AI:
            langchain_messages.append(AIMessage(content=msg.contents))
        else:
            logger.warning(f"Skipping unknown message type: {msg.type}")

    logger.info(
        f"Converted {len(langchain_messages)} DB messages to LangChain format",
    )
    return langchain_messages
