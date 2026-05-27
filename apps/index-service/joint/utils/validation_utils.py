from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from joint.logging import get_logger

logger = get_logger(__name__)


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return True  # Optional field

    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_pattern, email) is not None


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


def validate_and_fix_url(url: str) -> str:
    """
    Validate and auto-fix common URL issues

    Args:
        url: The URL to validate and fix

    Returns:
        Fixed URL string

    Raises:
        ValueError: If URL is invalid or suspicious
    """
    if not url or not url.strip():
        raise ValueError('URL cannot be empty')

    url = url.strip()

    # Remove common prefixes that users might add by mistake
    url = re.sub(r'^(url:|link:|website:)\s*', '', url, flags=re.IGNORECASE)

    # Auto-add https:// if no protocol specified
    if not re.match(r'^https?://', url, re.IGNORECASE):
        url = f"https://{url}"

    # Parse URL to validate components
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError('Invalid URL format')

    # Validate required components
    if not parsed.scheme or parsed.scheme.lower() not in ['http', 'https']:
        raise ValueError('URL must use HTTP or HTTPS protocol')

    if not parsed.netloc:
        raise ValueError('URL must have a valid domain')

    # Check for suspicious patterns
    suspicious_patterns = [
        r'localhost',
        r'127\.0\.0\.1',
        r'192\.168\.',
        r'10\.0\.',
        r'file://',
        r'javascript:',
        r'data:',
        r'<script',
        r'\.exe$',
        r'\.zip$',
        r'\.rar$',
    ]

    for pattern in suspicious_patterns:
        if re.search(pattern, url, re.IGNORECASE):
            raise ValueError(f"Suspicious URL pattern detected: {pattern}")

    # Basic domain validation
    domain = parsed.netloc.lower()
    if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
        raise ValueError('Invalid domain format')

    # Check for obvious spam domains (extend this list as needed)
    spam_domains = [
        'bit.ly',  # URL shorteners can be risky
        'tinyurl.com',
        't.co',
        'example.com',
        'test.com',
        'fake.com',
    ]

    if any(domain.endswith(spam) for spam in spam_domains):
        raise ValueError(f"Domain '{domain}' is not allowed")

    return url


def validate_datetime_string(date_string: Optional[str], field_name: str) -> Optional[datetime]:
    """
    Validate and convert datetime string to datetime object.

    Args:
        date_string: The datetime string to validate (ISO format expected)
        field_name: Name of the field for error messages

    Returns:
        datetime object if valid, None if input is None

    Raises:
        ValueError: If the datetime string format is invalid
    """
    if date_string is None:
        return None

    if date_string.strip() == '':
        return None

    # Try to parse different datetime formats
    datetime_formats = [
        '%Y-%m-%d',           # 2023-12-31
        '%Y-%m-%dT%H:%M:%S',  # 2023-12-31T23:59:59
        '%Y-%m-%d %H:%M:%S',  # 2023-12-31 23:59:59
        '%Y-%m-%dT%H:%M:%SZ',  # 2023-12-31T23:59:59Z
        '%Y-%m-%dT%H:%M:%S.%f',  # 2023-12-31T23:59:59.123456
        '%Y-%m-%dT%H:%M:%S.%fZ',  # 2023-12-31T23:59:59.123456Z
    ]

    for fmt in datetime_formats:
        try:
            return datetime.strptime(date_string.strip(), fmt)
        except ValueError:
            continue

    # If none of the formats work, raise an error
    raise ValueError(
        f"Invalid {field_name} format: '{date_string}'. "
        f"Expected ISO format like '2023-12-31' or '2023-12-31T23:59:59' or '2023-12-31 23:59:59'",
    )
