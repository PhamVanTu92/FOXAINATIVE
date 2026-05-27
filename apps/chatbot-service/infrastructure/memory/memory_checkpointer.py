"""In-memory checkpointer service for LangGraph development/testing."""
from __future__ import annotations

import threading
import time
from typing import Dict
from typing import Optional

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings
from langgraph.checkpoint.memory import MemorySaver

logger = get_logger(__name__)


class MemoryCheckpointerService(BaseModel):
    """
    In-memory checkpointer service for LangGraph.

    Provides conversation memory with manual cleanup for development/testing.
    Uses MemorySaver from LangGraph with added TTL and cleanup mechanisms.

    WARNING: Not recommended for production use:
    - Memory is lost on restart
    - No horizontal scaling support
    - Memory can grow unbounded without cleanup

    Attributes:
        settings: Application settings containing checkpointer configuration.
    """

    settings: Settings
    _checkpointer: Optional[MemorySaver] = None
    _thread_timestamps: Dict[str, float] = {}
    _lock: threading.Lock = threading.Lock()

    class Config:
        arbitrary_types_allowed = True

    def model_post_init(self, __context) -> None:
        """Initialize thread timestamps dict."""
        object.__setattr__(self, '_thread_timestamps', {})
        object.__setattr__(self, '_lock', threading.Lock())

    @property
    def ttl_minutes(self) -> int:
        """Get TTL in minutes from settings."""
        return self.settings.redis.checkpointer_ttl_minutes

    @property
    def ttl_seconds(self) -> int:
        """Get TTL in seconds."""
        return self.ttl_minutes * 60

    async def get_checkpointer(self) -> MemorySaver:
        """
        Get or create MemorySaver instance.

        Creates a new MemorySaver on first call, then returns cached instance.

        Returns:
            MemorySaver: Configured checkpointer.
        """
        if self._checkpointer is None:
            logger.warning(
                'Initializing in-memory checkpointer - not recommended for production',
                extra={'ttl_minutes': self.ttl_minutes},
            )
            object.__setattr__(self, '_checkpointer', MemorySaver())
            logger.info(
                'In-memory checkpointer initialized',
                extra={'ttl_minutes': self.ttl_minutes},
            )

        return self._checkpointer

    def track_thread_access(self, thread_id: str) -> None:
        """
        Track access time for a thread (for TTL-based cleanup).

        Args:
            thread_id: The thread/conversation ID to track.
        """
        with self._lock:
            self._thread_timestamps[thread_id] = time.time()

    async def clear_thread(self, thread_id: str) -> bool:
        """
        Clear all checkpoints for a specific thread (conversation).

        Note: MemorySaver doesn't have a native clear method,
        so we track threads manually and can only clear during cleanup.

        Args:
            thread_id: The conversation/thread ID to clear.

        Returns:
            bool: True if thread was tracked and removed from tracking.
        """
        with self._lock:
            if thread_id in self._thread_timestamps:
                del self._thread_timestamps[thread_id]
                logger.info(f"Cleared thread tracking: {thread_id}")
                return True
            logger.warning(f"Thread not found in tracking: {thread_id}")
            return False

    async def cleanup_expired(self) -> int:
        """
        Clean up expired threads based on TTL.

        Since MemorySaver doesn't support per-thread deletion,
        this logs expired threads. For actual cleanup, the entire
        checkpointer would need to be reset.

        Returns:
            int: Number of expired threads identified.
        """
        current_time = time.time()
        expired_threads = []

        with self._lock:
            for thread_id, timestamp in list(self._thread_timestamps.items()):
                age_seconds = current_time - timestamp
                if age_seconds > self.ttl_seconds:
                    expired_threads.append(thread_id)
                    del self._thread_timestamps[thread_id]

        if expired_threads:
            logger.info(
                f"Identified {len(expired_threads)} expired threads",
                # Log first 10
                extra={'expired_threads': expired_threads[:10]},
            )

        return len(expired_threads)

    async def reset(self) -> None:
        """
        Reset the entire checkpointer (clear all memory).

        This creates a new MemorySaver instance, clearing all stored state.
        """
        logger.warning(
            'Resetting in-memory checkpointer - all conversation state will be lost',
        )
        object.__setattr__(self, '_checkpointer', MemorySaver())
        with self._lock:
            self._thread_timestamps.clear()
        logger.info('In-memory checkpointer reset completed')

    async def close(self) -> None:
        """
        Close checkpointer and cleanup.

        For MemorySaver, this just clears references.
        """
        object.__setattr__(self, '_checkpointer', None)
        with self._lock:
            self._thread_timestamps.clear()
        logger.info('In-memory checkpointer closed')

    async def get_stats(self) -> dict:
        """
        Get statistics about the in-memory checkpointer.

        Returns:
            dict: Statistics including tracked thread count, TTL settings.
        """
        with self._lock:
            tracked_count = len(self._thread_timestamps)
            current_time = time.time()

            # Calculate thread ages
            thread_ages = {}
            for thread_id, timestamp in list(self._thread_timestamps.items())[:10]:
                age_seconds = current_time - timestamp
                thread_ages[thread_id] = {
                    'age_seconds': int(age_seconds),
                    'is_expired': age_seconds > self.ttl_seconds,
                }

        return {
            'backend': 'memory',
            'tracked_threads': tracked_count,
            'ttl_minutes': self.ttl_minutes,
            'ttl_seconds': self.ttl_seconds,
            'sample_threads': thread_ages,
            'warning': 'In-memory checkpointer - not recommended for production',
        }
