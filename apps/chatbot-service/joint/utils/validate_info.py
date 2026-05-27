from __future__ import annotations

import re

from joint.logging import get_logger

logger = get_logger(__name__)


def validate_vietnam_phone(phone: str) -> tuple[bool, str]:
    """
    Comprehensive validation for Vietnamese phone number format

    Args:
        phone: Phone number string to validate

    Returns:
        tuple[bool, str]: (is_valid, error_message)
    """
    if not phone:
        return False, 'Phone number is required'

    if not phone.strip():
        return False, 'Phone number cannot be empty or whitespace'

    # Remove all non-digit characters except + at start
    clean_phone = phone.strip()

    # Check for invalid characters (only digits, +, spaces, dashes, dots allowed)
    allowed_chars = set('0123456789+- .')
    if not all(c in allowed_chars for c in clean_phone):
        return False, 'Phone number contains invalid characters. Only digits, +, -, spaces, and dots are allowed'

    # Remove spaces, dashes, and dots for pattern matching
    normalized = re.sub(r'[\s\-\.]', '', clean_phone)

    # Check length constraints
    if len(normalized) < 10:
        return False, 'Phone number is too short. Vietnamese numbers should have 10-12 digits'

    if len(normalized) > 13:  # +84 + 9 digits = 12, allow some flexibility
        return False, 'Phone number is too long. Vietnamese numbers should have 10-12 digits'

    # Vietnamese mobile phone patterns
    # Mobile prefixes: 32-39, 56,58,59, 70,76-79, 81-89, 90,93,94,96-99
    mobile_patterns = [
        # International format: +84xxxxxxxxx
        r'^(\+84)(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$',
        # Country code format: 84xxxxxxxxx
        r'^(84)(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$',
        # Local format: 0xxxxxxxxx
        r'^(0)(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$',
    ]

    # Check if matches any valid pattern
    for pattern in mobile_patterns:
        if re.match(pattern, normalized):
            return True, ''

    # Specific error messages for common mistakes
    if normalized.startswith('+84'):
        if len(normalized) != 12:
            return False, 'International format (+84) should have exactly 12 digits total'
        return False, 'Invalid mobile prefix. Vietnamese mobile numbers start with 032-039, 056/058/059, 070/076-079, 081-089, 090/093/094/096-099'

    elif normalized.startswith('84'):
        if len(normalized) != 11:
            return False, 'Country code format (84) should have exactly 11 digits total'
        return False, 'Invalid mobile prefix. Vietnamese mobile numbers start with 32-39, 56/58/59, 70/76-79, 81-89, 90/93/94/96-99'

    elif normalized.startswith('0'):
        if len(normalized) != 10:
            return False, 'Local format (0) should have exactly 10 digits total'
        return False, 'Invalid mobile prefix. Vietnamese mobile numbers start with 032-039, 056/058/059, 070/076-079, 081-089, 090/093/094/096-099'

    else:
        return False, 'Phone number must start with +84, 84, or 0'


def normalize_phone(phone: str) -> str:
    """
    Normalize Vietnamese phone number to +84 format

    Args:
        phone: Phone number string to normalize

    Returns:
        str: Normalized phone number in +84 format
    """
    clean_phone = re.sub(r'[\s\-\.]', '', phone)

    if clean_phone.startswith('+84'):
        return clean_phone
    elif clean_phone.startswith('84'):
        return '+' + clean_phone
    elif clean_phone.startswith('0'):
        return '+84' + clean_phone[1:]
    else:
        return '+84' + clean_phone


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return True  # Optional field

    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_pattern, email) is not None
