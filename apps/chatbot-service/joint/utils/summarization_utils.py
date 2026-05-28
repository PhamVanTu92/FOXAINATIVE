"""Utilities for conversation summarization and message management."""
from __future__ import annotations

from typing import List

from joint.logging import get_logger
from langchain_core.messages import BaseMessage
from langchain_core.messages import RemoveMessage
from langchain_core.messages import SystemMessage
from langchain_core.messages import trim_messages

logger = get_logger(__name__)


def should_summarize_conversation(
    messages: List[BaseMessage],
    total_tokens: int,
    max_context_window: int = 1000000,
    max_output_tokens: int = 2048,
    summarization_threshold: float = 0.5,
    safety_buffer: int = 1000,
) -> bool:
    """
    Determine if conversation should be summarized based on token usage.

    Args:
        messages: Current message list
        total_tokens: Total tokens used so far (input only)
        max_context_window: Maximum context window size (default: 128k for GPT-4o)
        max_output_tokens: Maximum tokens reserved for output
        summarization_threshold: Trigger summarization at this percentage of AVAILABLE context (default: 50%)
        safety_buffer: Additional safety buffer in tokens (default: 1000)

    Returns:
        True if conversation should be summarized, False otherwise
    """
    # Calculate available space for input (context - output - buffer)
    available_for_input = max_context_window - max_output_tokens - safety_buffer

    # Calculate threshold based on available input space
    threshold_tokens = int(available_for_input * summarization_threshold)

    # Count non-system messages (to preserve system prompt)
    non_system_messages = [
        m for m in messages if not isinstance(m, SystemMessage)
    ]

    should_summarize = (
        total_tokens > threshold_tokens and
        # Only summarize if there are enough messages
        len(non_system_messages) > 5
    )

    if should_summarize:
        logger.info(
            f'Summarization triggered: {total_tokens}/{available_for_input} tokens '
            f'({total_tokens/available_for_input*100:.1f}% of available input space) '
            f'[Context: {max_context_window}, Output: {max_output_tokens}, Buffer: {safety_buffer}]',
        )

    return should_summarize


def create_summary_message(summary: str) -> SystemMessage:
    """
    Create a SystemMessage containing the conversation summary.

    We use a SystemMessage on purpose so the summary acts as internal context
    for the agent's next call and is NOT treated as user-visible content.

    The message includes an explicit instruction to the model: do not repeat
    or echo this summary to the user. This reduces the risk the assistant will
    verbatim include the summary in its streamed output.

    Args:
        summary: Summarized conversation text

    Returns:
        SystemMessage with summary as content and an instruction not to repeat it
    """
    summary_content = f"""[INTERNAL CONVERSATION SUMMARY - DO NOT REPEAT TO USER]

{summary}

[END INTERNAL SUMMARY]"""

    instruction = (
        'Use the information in the internal summary to inform your next responses. '
        'Do NOT repeat, quote, or expose the summary verbatim to the user. '
        'Treat it as developer/system-level context only.'
    )

    return SystemMessage(content=instruction + '\n\n' + summary_content)


def prepare_messages_for_removal(
    messages: List[BaseMessage],
    keep_count: int = 2,
) -> List[RemoveMessage]:
    """
    Prepare RemoveMessage objects for old conversation messages.
    Uses LangGraph's RemoveMessage pattern to delete messages from state.

    Args:
        messages: List of messages to process (non-system messages)
        keep_count: Number of most recent messages to keep

    Returns:
        List of RemoveMessage objects to remove old messages from state
    """
    if len(messages) <= keep_count:
        return []

    # Get old messages to remove (all except the most recent keep_count)
    old_messages = messages[:-keep_count]

    # Create RemoveMessage objects
    remove_messages = [
        RemoveMessage(id=m.id)
        for m in old_messages
        if hasattr(m, 'id') and m.id
    ]

    logger.info(
        f"Prepared {len(remove_messages)} RemoveMessage objects for state cleanup",
    )

    return remove_messages


def trim_messages_for_llm(
    messages: List[BaseMessage],
    max_tokens: int = 20,
    include_system: bool = True,
) -> List[BaseMessage]:
    """
    Trim messages for LLM input using LangGraph's trim_messages.
    This is used for LLM context window management, not state cleanup.

    Args:
        messages: Messages to trim
        max_tokens: Maximum number of messages to keep (token_counter=len)
        include_system: Whether to preserve SystemMessage

    Returns:
        Trimmed list of messages
    """
    return trim_messages(
        messages,
        token_counter=len,
        strategy='last',
        max_tokens=max_tokens,
        start_on='human',
        end_on=('human', 'tool'),
        include_system=include_system,
    )
