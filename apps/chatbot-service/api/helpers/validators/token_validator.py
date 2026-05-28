"""Token validation utilities for user input."""
from __future__ import annotations

from typing import Tuple

from joint.logging import get_logger
from joint.utils.token_counter import str_token_counter

logger = get_logger(__name__)

# Token limits
MAX_USER_INPUT_TOKENS = 8000  # Maximum tokens for a single user message
MAX_USER_INPUT_CHARS = 32000  # Soft limit: ~4 chars per token for quick check


def validate_user_input_length(message: str, user_id: str | None = None) -> Tuple[bool, str, int]:
    """
    Validate user input message length against token limits.

    Args:
        message: User input message
        user_id: User ID for logging (optional)

    Returns:
        Tuple of (is_valid, error_message, token_count)
        - is_valid: True if message is within limits
        - error_message: Error message if invalid, empty string if valid
        - token_count: Actual token count of the message
    """
    # Quick check: character count (faster than token counting)
    char_count = len(message)
    if char_count > MAX_USER_INPUT_CHARS:
        logger.warning(
            'User input exceeds character limit',
            extra={
                'user_id': user_id,
                'char_count': char_count,
                'max_chars': MAX_USER_INPUT_CHARS,
            },
        )
        return (
            False,
            f"Message too long. Maximum {MAX_USER_INPUT_CHARS} characters allowed, got {char_count}",
            0,
        )

    # Accurate check: token count
    token_count = str_token_counter(message)

    if token_count > MAX_USER_INPUT_TOKENS:
        logger.warning(
            'User input exceeds token limit',
            extra={
                'user_id': user_id,
                'token_count': token_count,
                'max_tokens': MAX_USER_INPUT_TOKENS,
                'char_count': char_count,
            },
        )
        return (
            False,
            f"Message too long. Maximum {MAX_USER_INPUT_TOKENS} tokens allowed, got {token_count}. "
            f"Please shorten your message.",
            token_count,
        )

    logger.info(
        'User input validated successfully',
        extra={
            'user_id': user_id,
            'token_count': token_count,
            'char_count': char_count,
        },
    )

    return (True, '', token_count)
