"""Database dependencies for FastAPI and background task handlers.

This module provides database session management for the Index service:
- Singleton connection pool to prevent resource exhaustion
- Short-lived sessions for REST API endpoints
- Factory pattern for background task processors
- Async session support for future async migration
"""
from __future__ import annotations

from typing import AsyncGenerator
from typing import Callable
from typing import ContextManager
from typing import Generator

from fastapi import Depends
from joint.postgres import SQLDatabase
from joint.settings.settings import PostgresSettings
from joint.utils import get_settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session


# Module-level singleton for connection pool reuse
_database_instance: SQLDatabase | None = None


def _get_database_instance(settings: PostgresSettings) -> SQLDatabase:
    """Get or create singleton database instance.

    Ensures only one connection pool exists for the entire application,
    preventing connection exhaustion under high load.

    Args:
        settings: PostgreSQL connection settings.

    Returns:
        Singleton SQLDatabase instance.
    """
    global _database_instance
    if _database_instance is None:
        _database_instance = SQLDatabase(
            host=settings.host,
            port=settings.port,
            db=settings.db,
            username=settings.username,
            password=settings.password,
            pool_size=settings.pool_size,
            max_overflow=settings.max_overflow,
            pool_timeout=settings.pool_timeout,
            pool_recycle=settings.pool_recycle,
        )
    return _database_instance


def get_postgres_settings() -> PostgresSettings:
    """Get PostgreSQL settings from application config.

    Returns:
        PostgreSQL connection settings.
    """
    settings = get_settings()
    return settings.postgres


def get_db_session(
    settings: PostgresSettings = Depends(get_postgres_settings),
) -> Generator[Session, None, None]:
    """Get database session for FastAPI dependency injection.

    Args:
        settings: PostgreSQL settings from dependency injection.

    Yields:
        Database session with automatic cleanup.
    """
    database = _get_database_instance(settings)
    with database.get_session() as session:
        yield session


def get_db_session_factory(settings: PostgresSettings) -> Callable[[], ContextManager[Session]]:
    """Create factory for short-lived database sessions.

    Essential for background task processors where holding a session for
    the entire task duration would exhaust the connection pool.

    Args:
        settings: PostgreSQL connection settings.

    Returns:
        Callable that returns a session context manager.
    """
    database = _get_database_instance(settings)
    return database.get_session


# -- Async session dependencies -------------------------------------------


async def get_async_db_session(
    settings: PostgresSettings = Depends(get_postgres_settings),
) -> AsyncGenerator[AsyncSession, None]:
    """Get an async database session for short-lived endpoints.

    Args:
        settings: PostgreSQL settings (injected by FastAPI).

    Yields:
        AsyncSession with automatic cleanup.
    """
    database = _get_database_instance(settings)
    async with database.get_async_session() as session:
        yield session


def get_async_db_session_factory(
    settings: PostgresSettings = Depends(get_postgres_settings),
) -> Callable:
    """Get async session factory for long-lived endpoints.

    Returns a callable that creates async context-manager sessions on
    demand, so DB connections are acquired and released per-operation
    rather than held for the entire request.

    Args:
        settings: PostgreSQL settings (injected by FastAPI).

    Returns:
        Async context-manager factory (``SQLDatabase.get_async_session``).
    """
    database = _get_database_instance(settings)
    return database.get_async_session


def reset_database_instance() -> None:
    """Reset singleton database instance (for worker lifecycle management)."""
    global _database_instance
    _database_instance = None
