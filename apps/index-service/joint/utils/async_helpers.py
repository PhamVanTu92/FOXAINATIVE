"""Async helpers for HTTP client pooling.

Provides a singleton httpx.AsyncClient with connection pooling to avoid
creating a new TCP connection per request (socket exhaustion under load).
"""
from __future__ import annotations

import httpx

from joint.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# HTTP Client Singleton
# ---------------------------------------------------------------------------
_http_client: httpx.AsyncClient | None = None


async def get_shared_http_client() -> httpx.AsyncClient:
    """Get or create singleton HTTP client with connection pooling.

    Returns:
        Shared httpx.AsyncClient instance.
    """
    global _http_client

    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100,
                keepalive_expiry=30.0,
            ),
        )
        logger.info('Shared HTTP client initialized with connection pooling')

    return _http_client


async def close_shared_http_client() -> None:
    """Close shared HTTP client on application shutdown."""
    global _http_client

    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.info('Shared HTTP client closed')
