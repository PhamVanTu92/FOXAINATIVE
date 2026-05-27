"""SQL database connection manager for Index Service.

Provides both sync (psycopg2) and async (psycopg v3) engines so that:
- Sync engine  -> used by Alembic migrations and existing domain services.
- Async engine -> available for future async migration of hot paths.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from contextlib import contextmanager
from functools import cached_property
from typing import AsyncGenerator
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from ..models import Base


class SQLDatabase:
    """PostgreSQL database connection manager with configurable pooling.

    Pool sizes are driven by ``PostgresSettings`` fields so they can be
    tuned per-environment via ``POSTGRES__POOL_SIZE`` /
    ``POSTGRES__MAX_OVERFLOW`` environment variables.
    """

    def __init__(
        self,
        username: str,
        password: str,
        host: str,
        db: str,
        port: int,
        *,
        pool_size: int = 20,
        max_overflow: int = 20,
        pool_timeout: int = 30,
        pool_recycle: int = 3600,
    ) -> None:
        """Initialize database connection parameters.

        Args:
            username: PostgreSQL username.
            password: PostgreSQL password.
            host: PostgreSQL host (container name or IP).
            db: Database name.
            port: PostgreSQL port.
            pool_size: Base number of persistent connections.
            max_overflow: Extra temporary connections above *pool_size*.
            pool_timeout: Seconds to wait for a free connection.
            pool_recycle: Seconds before recycling a connection.
        """
        self.username = username
        self.password = password
        self.host = host
        self.db = db
        self.port = port
        self._pool_size = pool_size
        self._max_overflow = max_overflow
        self._pool_timeout = pool_timeout
        self._pool_recycle = pool_recycle
        self._sync_engine = None
        self._async_engine = None

    # -- Sync engine (psycopg2) ------------------------------------------

    @cached_property
    def sessionmaker(self) -> sessionmaker:
        """Create sync database engine with configurable connection pooling."""
        self._sync_engine = create_engine(
            f'postgresql+psycopg2://{self.username}:{self.password}@{self.host}:{self.port}/{self.db}',
            pool_size=self._pool_size,
            max_overflow=self._max_overflow,
            pool_timeout=self._pool_timeout,
            pool_pre_ping=True,
            pool_recycle=self._pool_recycle,
            pool_reset_on_return='rollback',
            echo_pool=False,
        )
        Base.metadata.create_all(self._sync_engine)
        return sessionmaker(autoflush=False, bind=self._sync_engine)

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """Context manager for sync database sessions with automatic cleanup.

        Yields:
            SQLAlchemy Session object.
        """
        session: Session | None = None
        try:
            session = self.sessionmaker()
            yield session
        finally:
            if session is not None:
                session.close()

    # -- Async engine (psycopg v3) ----------------------------------------

    @cached_property
    def async_sessionmaker(self) -> async_sessionmaker[AsyncSession]:
        """Create async engine with the same pool parameters.

        Uses ``postgresql+psycopg://`` (psycopg v3 async adapter).
        """
        self._async_engine = create_async_engine(
            f'postgresql+psycopg://{self.username}:{self.password}@{self.host}:{self.port}/{self.db}',
            pool_size=self._pool_size,
            max_overflow=self._max_overflow,
            pool_timeout=self._pool_timeout,
            pool_pre_ping=True,
            pool_recycle=self._pool_recycle,
            pool_reset_on_return='rollback',
            echo_pool=False,
        )
        return async_sessionmaker(self._async_engine, expire_on_commit=False)

    @asynccontextmanager
    async def get_async_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Async context manager for database sessions.

        Yields:
            AsyncSession with automatic cleanup.
        """
        async with self.async_sessionmaker() as session:
            try:
                yield session
            finally:
                await session.close()

    # -- Lifecycle helpers ------------------------------------------------

    def dispose_sync(self) -> None:
        """Dispose the sync engine and release all pooled connections."""
        if self._sync_engine is not None:
            self._sync_engine.dispose()
            self._sync_engine = None
        self.__dict__.pop('sessionmaker', None)

    async def dispose_async(self) -> None:
        """Dispose the async engine and release all pooled connections."""
        if self._async_engine is not None:
            await self._async_engine.dispose()
            self._async_engine = None
        self.__dict__.pop('async_sessionmaker', None)
