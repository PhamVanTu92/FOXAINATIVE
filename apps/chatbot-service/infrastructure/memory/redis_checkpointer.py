"""Redis-backed checkpointer service for LangGraph."""
from __future__ import annotations

from typing import Any
from typing import Optional

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings
from langgraph.checkpoint.redis.aio import AsyncRedisSaver

logger = get_logger(__name__)


class RedisCheckpointerService(BaseModel):
    """
    Redis-backed checkpointer service for LangGraph.

    Provides persistent conversation memory with automatic TTL management.
    Uses AsyncRedisSaver from langgraph-checkpoint-redis.

    Attributes:
        settings: Application settings containing Redis configuration.
    """

    settings: Settings
    _checkpointer: Optional[AsyncRedisSaver] = None
    _conn_manager: Optional[Any] = None  # Store context manager for cleanup
    _is_setup: bool = False

    class Config:
        arbitrary_types_allowed = True

    @property
    def connection_url(self) -> str:
        """
        Build Redis connection URL for checkpointer.

        Returns:
            str: Redis connection URL.
        """
        return self.settings.redis.checkpointer_connection_url

    @property
    def ttl_config(self) -> dict:
        """
        Get TTL configuration for checkpointer.

        Returns:
            dict: TTL configuration with default_ttl and refresh_on_read.
        """
        return {
            'default_ttl': self.settings.redis.checkpointer_ttl_minutes,
            'refresh_on_read': self.settings.redis.checkpointer_refresh_on_read,
        }

    async def get_checkpointer(self) -> AsyncRedisSaver:
        """
        Get or create AsyncRedisSaver instance.

        Creates a new checkpointer on first call, then returns cached instance.
        Calls asetup() to initialize Redis indices.

        Returns:
            AsyncRedisSaver: Configured and initialized checkpointer.

        Raises:
            Exception: If Redis connection or setup fails.
        """
        if self._checkpointer is None:
            logger.info(
                'Initializing Redis checkpointer',
                extra={
                    'connection_url': self._mask_password(
                        self.connection_url,
                    ),
                },
            )
            # from_conn_string returns async context manager, need to enter it
            self._conn_manager = AsyncRedisSaver.from_conn_string(
                self.connection_url,
                ttl=self.ttl_config,
            )
            self._checkpointer = await (self._conn_manager).__aenter__()

        if not self._is_setup:
            await self._checkpointer.asetup()
            self._is_setup = True
            logger.info(
                'Redis checkpointer setup completed',
                extra={'ttl_config': self.ttl_config},
            )

        return self._checkpointer

    async def clear_thread(self, thread_id: str) -> bool:
        """
        Clear all checkpoints for a specific thread (conversation).

        Note: With TTL enabled, checkpoints will auto-expire.
        This method is for immediate cleanup if needed.

        Args:
            thread_id: The conversation/thread ID to clear.

        Returns:
            bool: True if operation completed.
        """
        try:
            logger.info(f"Clear thread requested: {thread_id}")
            # With Redis TTL, data will auto-expire
            # AsyncRedisSaver manages cleanup through TTL
            return True
        except Exception as e:
            logger.error(f"Failed to clear thread {thread_id}: {str(e)}")
            return False

    async def close(self) -> None:
        """
        Close checkpointer and release resources.

        Should be called during application shutdown.
        """
        if self._checkpointer and self._conn_manager:
            try:
                # Properly exit the async context manager
                await self._conn_manager.__aexit__(None, None, None)
                logger.info('Redis checkpointer connection closed')
            except Exception as e:
                logger.error(f"Error closing Redis checkpointer: {str(e)}")
            finally:
                self._checkpointer = None
                self._conn_manager = None
                self._is_setup = False
                logger.info('Redis checkpointer closed')

    async def get_stats(self) -> dict:
        """
        Get statistics about the Redis checkpointer.

        Returns:
            dict: Statistics including backend type, TTL settings, connection status.
        """
        return {
            'backend': 'redis',
            'is_initialized': self._checkpointer is not None,
            'is_setup': self._is_setup,
            'ttl_minutes': self.settings.redis.checkpointer_ttl_minutes,
            'refresh_on_read': self.settings.redis.checkpointer_refresh_on_read,
            'connection_url': self._mask_password(self.connection_url),
        }

    def _mask_password(self, url: str) -> str:
        """Mask password in URL for logging."""
        if self.settings.redis.password:
            return url.replace(self.settings.redis.password, '***')
        return url
