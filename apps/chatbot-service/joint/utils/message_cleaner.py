"""
Message cleaning utilities to remove injected context before saving to database.
Ensures clean message history display without file context bloat.
"""
from __future__ import annotations

import re

from joint.logging import get_logger

logger = get_logger(__name__)


def extract_user_query_from_context(message: str) -> str:
    """
    Extract original user query from message that may contain file context.

    This function strips the injected file context pattern and returns only
    the user's actual question/message.

    Supports both single file and multiple files format:
    - New format: Uses ════════... separators with "TÀI LIỆU X/Y" headers
    - Old format: Uses ---BẮT ĐẦU/KẾT THÚC NỘI DUNG TÀI LIỆU--- separators

    Args:
        message: Full message that may contain file context injection

    Returns:
        Clean user query without file context

    Example (new format - multiple files):
        Input:
            "Tôi đã tải lên 2 tài liệu với nội dung sau:
             ════════════════════════════════════════════════════════════════
             TÀI LIỆU 1/2: file1.pdf
             ...content...
             ════════════════════════════════════════════════════════════════
             KẾT THÚC TÀI LIỆU 1
             ════════════════════════════════════════════════════════════════
             ...
             Dựa trên nội dung 2 tài liệu trên, vui lòng giúp tôi: What is this?"

        Output:
            "What is this?"
    """
    # Pattern 1: New format with multiple files (════════... separators)
    # Matches:
    # - "Tôi đã tải lên một tài liệu với nội dung sau:" OR
    # - "Tôi đã tải lên X tài liệu với nội dung sau:"
    # Then captures everything until "Dựa trên nội dung ... vui lòng giúp tôi:"
    pattern_new = (
        r'Tôi đã tải lên (?:một|\d+) tài liệu với nội dung sau:\s*'
        r'(?:═+\s*TÀI LIỆU.*?═+\s*KẾT THÚC TÀI LIỆU.*?═+\s*)+\s*'
        r'Dựa trên nội dung (?:tài liệu trên|\d+ tài liệu trên),?\s*(?:vui lòng giúp tôi:?)?\s*'
    )

    # Try new pattern first
    cleaned = re.sub(pattern_new, '', message, flags=re.DOTALL | re.IGNORECASE)

    if cleaned != message:
        logger.debug(
            'Extracted user query from file context message (new format)',
            extra={
                'original_length': len(message),
                'cleaned_length': len(cleaned),
                'format': 'multiple_files_new',
            },
        )
        return cleaned.strip()

    # Pattern 2: Old format (backward compatibility)
    pattern_old = (
        r'Tôi đã tải lên một tài liệu với nội dung sau:\s*'
        r'---BẮT ĐẦU NỘI DUNG TÀI LIỆU---.*?---KẾT THÚC NỘI DUNG TÀI LIỆU---\s*'
        r'Dựa trên nội dung tài liệu trên,?\s*(?:vui lòng giúp tôi:?)?\s*'
    )

    cleaned = re.sub(pattern_old, '', message, flags=re.DOTALL | re.IGNORECASE)

    if cleaned != message:
        logger.debug(
            'Extracted user query from file context message (old format)',
            extra={
                'original_length': len(message),
                'cleaned_length': len(cleaned),
                'format': 'single_file_old',
            },
        )
        return cleaned.strip()

    # No pattern matched - return original message
    logger.debug('No file context pattern found - returning original message')
    return message.strip()
