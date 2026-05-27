"""Factory for creating LangGraph checkpointer instances."""
from __future__ import annotations

from typing import Optional
from typing import Union

from joint.logging import get_logger
from joint.settings import Settings
from langgraph.checkpoint.base import BaseCheckpointSaver

from .memory_checkpointer import MemoryCheckpointerService
from .redis_checkpointer import RedisCheckpointerService

logger = get_logger(__name__)

# Global singletons for checkpointer services
_REDIS_SERVICE: Optional[RedisCheckpointerService] = None
_MEMORY_SERVICE: Optional[MemoryCheckpointerService] = None

# Type alias for service union
CheckpointerService = Union[
    RedisCheckpointerService,
    MemoryCheckpointerService,
]


class CheckpointerFactory:
    """
    Factory for creating LangGraph checkpointer instances.

    Supports different backends:
    - redis: Production backend with persistence and automatic TTL
    - memory: Development/testing backend (in-memory, manual TTL)

    Uses singleton pattern to reuse connections and track services.
    """

    @classmethod
    async def get_checkpointer(
        cls,
        settings: Settings,
        backend: str = 'redis',
    ) -> BaseCheckpointSaver:
        """
        Get checkpointer instance based on backend type.

        Args:
            settings: Application settings.
            backend: Backend type - 'redis' or 'memory'.

        Returns:
            BaseCheckpointSaver: Configured checkpointer instance.

        Raises:
            ValueError: If unknown backend type is specified.
        """
        global _REDIS_SERVICE, _MEMORY_SERVICE

        if backend == 'memory':
            if _MEMORY_SERVICE is None:
                _MEMORY_SERVICE = MemoryCheckpointerService(settings=settings)
            return await _MEMORY_SERVICE.get_checkpointer()

        if backend == 'redis':
            if _REDIS_SERVICE is None:
                _REDIS_SERVICE = RedisCheckpointerService(settings=settings)
            return await _REDIS_SERVICE.get_checkpointer()

        raise ValueError(f"Unknown checkpointer backend: {backend}")

    @classmethod
    def get_service(cls, backend: Optional[str] = None) -> Optional[CheckpointerService]:
        """
        Get the current checkpointer service instance.

        Args:
            backend: Optional backend type to get specific service.
                    If None, returns the active service (redis first, then memory).

        Returns:
            Optional[CheckpointerService]: Service instance or None.
        """
        if backend == 'redis':
            return _REDIS_SERVICE
        if backend == 'memory':
            return _MEMORY_SERVICE

        # Return whichever is active (prefer redis)
        return _REDIS_SERVICE or _MEMORY_SERVICE

    @classmethod
    def get_active_backend(cls) -> Optional[str]:
        """
        Get the name of the currently active backend.

        Returns:
            Optional[str]: 'redis', 'memory', or None if no backend is active.
        """
        if _REDIS_SERVICE is not None:
            return 'redis'
        if _MEMORY_SERVICE is not None:
            return 'memory'
        return None

    @classmethod
    async def close(cls) -> None:
        """
        Close all checkpointer connections and cleanup.

        Should be called during application shutdown.
        """
        global _REDIS_SERVICE, _MEMORY_SERVICE

        if _REDIS_SERVICE:
            await _REDIS_SERVICE.close()
            _REDIS_SERVICE = None
            logger.info('Redis checkpointer service closed')

        if _MEMORY_SERVICE:
            await _MEMORY_SERVICE.close()
            _MEMORY_SERVICE = None
            logger.info('Memory checkpointer service closed')

        logger.info('Checkpointer factory closed')
