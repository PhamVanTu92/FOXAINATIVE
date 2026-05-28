"""Utilities for processing and managing messages."""
from __future__ import annotations

from typing import List

from joint.logging import get_logger
from langchain_core.messages import BaseMessage
from langchain_core.messages import ToolMessage

from .token_counter import tiktoken_counter

logger = get_logger(__name__)


def truncate_tool_message(tool_message: ToolMessage, max_tokens: int) -> ToolMessage:
    """
    Truncate a ToolMessage content to fit within token limit.

    Args:
        tool_message: ToolMessage to truncate
        max_tokens: Maximum tokens allowed

    Returns:
        New ToolMessage with truncated content
    """
    content = str(tool_message.content)
    current_tokens = tiktoken_counter([tool_message])

    if current_tokens <= max_tokens:
        return tool_message

    logger.warning(
        f"ToolMessage '{tool_message.name}' has {current_tokens} tokens, "
        f"truncating to {max_tokens}",
    )

    # Calculate how much to keep (rough estimate: 1 token = 4 chars)
    ratio = max_tokens / current_tokens
    chars_to_keep = int(len(content) * ratio * 0.95)  # 95% to be safe

    # Smart truncation: try to keep complete sentences
    truncated = content[:chars_to_keep]

    # Try to cut at paragraph
    paragraph_end = truncated.rfind('\n\n')
    if paragraph_end > chars_to_keep * 0.7:
        truncated = content[:paragraph_end] + \
            '\n\n[...content truncated due to length...]'
    # Try to cut at sentence
    elif (sentence_end := truncated.rfind('. ')) > chars_to_keep * 0.8:
        truncated = content[:sentence_end + 1] + ' [...]'
    else:
        truncated = truncated + '...'

    # Create new ToolMessage with truncated content
    return ToolMessage(
        content=truncated,
        tool_call_id=tool_message.tool_call_id,
        name=tool_message.name if hasattr(tool_message, 'name') else None,
    )


def process_tool_messages(
    messages: List[BaseMessage],
    max_tool_message_tokens: int = 40000,
) -> List[BaseMessage]:
    """
    Process ToolMessages to ensure they fit within token limits.

    Args:
        messages: List of messages to process
        max_tool_message_tokens: Maximum tokens allowed for a single ToolMessage

    Returns:
        List of messages with truncated ToolMessages
    """
    processed_messages = []

    for msg in messages:
        if isinstance(msg, ToolMessage):
            # Check token count for this ToolMessage
            msg_tokens = tiktoken_counter([msg])

            if msg_tokens > max_tool_message_tokens:
                logger.info(
                    f"Processing large ToolMessage '{msg.name}': "
                    f"{msg_tokens} tokens",
                )
                msg = truncate_tool_message(msg, max_tool_message_tokens)

            processed_messages.append(msg)
        else:
            processed_messages.append(msg)

    return processed_messages
