"""
Async Helpers - Background task management, HTTP client pooling, and DB operation helpers.

This module provides utilities for:
1. Background task tracking to prevent memory leaks
2. Reusable HTTP client with connection pooling
3. Thread-safe sync DB operation execution for async contexts
"""
from __future__ import annotations

import asyncio
from typing import Any, Callable, Coroutine, TypeVar

import httpx

from joint.logging import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


# ============================================================================
# Background Task Manager
# ============================================================================
_background_tasks: set[asyncio.Task] = set()


def create_background_task(coro: Coroutine) -> asyncio.Task:
    """
    Create and track background task to prevent memory/task leak.
    
    Problem:
        Using asyncio.create_task() without keeping a reference causes:
        - Tasks never get garbage collected
        - PIDs accumulate indefinitely (observed: 425+ PIDs)
        - Event loop becomes overwhelmed
        - Service unable to respond to requests/health checks
    
    Solution:
        Track tasks in a module-level set and auto-remove on completion.
        This ensures proper cleanup and prevents resource exhaustion.
    
    Args:
        coro: Coroutine to run in background
        
    Returns:
        asyncio.Task: The created and tracked task
        
    Example:
        >>> async def generate_title():
        ...     await some_long_operation()
        >>> 
        >>> # Don't do this - task leak
        >>> asyncio.create_task(generate_title())
        >>>
        >>> # Do this - properly tracked
        >>> create_background_task(generate_title())
    
    Note:
        Tasks are automatically discarded from tracking set when completed.
        No need to manually cleanup.
    """
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    
    logger.debug(
        f"Background task created. Active tasks: {len(_background_tasks)}",
    )
    
    return task


def get_active_task_count() -> int:
    """
    Get number of active background tasks.
    
    Returns:
        int: Number of tasks currently tracked
        
    Example:
        >>> count = get_active_task_count()
        >>> logger.info(f"Active background tasks: {count}")
    """
    return len(_background_tasks)


# ============================================================================
# HTTP Client Singleton
# ============================================================================
_http_client: httpx.AsyncClient | None = None


async def get_shared_http_client() -> httpx.AsyncClient:
    """
    Get or create singleton HTTP client with connection pooling.
    
    Problem:
        Creating new httpx.AsyncClient for each request causes:
        - New socket connections every time
        - Socket exhaustion under high load
        - Poor performance and resource waste
    
    Solution:
        Reuse a single client instance with connection pooling configured
        for optimal performance and resource utilization.
    
    Connection Pool Configuration:
        - max_keepalive_connections: 20 persistent connections
        - max_connections: 100 total concurrent connections
        - keepalive_expiry: 30s idle timeout before closing
    
    Returns:
        httpx.AsyncClient: Shared HTTP client with connection pooling
        
    Example:
        >>> client = await get_shared_http_client()
        >>> response = await client.get("https://api.example.com/data")
        >>> # No need to close - handled by shutdown lifecycle
    
    Note:
        Remember to call close_shared_http_client() on application shutdown.
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
        logger.info("Shared HTTP client initialized with connection pooling")
    
    return _http_client


async def close_shared_http_client() -> None:
    """
    Close shared HTTP client on application shutdown.
    
    This should be called during application lifecycle shutdown event
    to ensure proper cleanup of connection pools.
    
    Example:
        >>> # In FastAPI lifespan
        >>> @asynccontextmanager
        >>> async def lifespan(app: FastAPI):
        ...     yield
        ...     await close_shared_http_client()
    """
    global _http_client
    
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.info("Shared HTTP client closed")


# ============================================================================
# Async DB Operation Executor (greenlet-based, no threadpool)
# ============================================================================

async def run_db_operation(
    async_session_factory: Callable[..., Any],
    fn: Callable[..., T],
    *args: Any,
) -> T:
    """Execute a sync DB function via AsyncSession.run_sync (greenlet).

    Uses SQLAlchemy's greenlet adapter to run existing sync service
    code on top of the async psycopg v3 driver.  This eliminates the
    threadpool overhead while keeping the domain service code unchanged.

    The async session is acquired and released per-call, so DB
    connections are returned to the pool immediately.

    Args:
        async_session_factory: Async context-manager factory that yields
            an ``AsyncSession`` (e.g. ``SQLDatabase.get_async_session``).
        fn: Sync function whose **last positional arg** receives a
            sync ``Session`` (provided by ``run_sync``).
        *args: Arguments forwarded to *fn* before the session.

    Returns:
        Whatever *fn* returns.

    Example::

        result = await run_db_operation(
            async_db_factory,
            self.creating_conversation_service.process,
            conversation_input,
        )
    """
    async with async_session_factory() as session:
        def _execute(sync_session: Any) -> T:
            return fn(*args, sync_session)

        return await session.run_sync(_execute)
