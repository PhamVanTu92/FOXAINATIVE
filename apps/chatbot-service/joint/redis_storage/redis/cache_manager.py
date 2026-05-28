"""Redis Cache Manager for caching operations."""
from __future__ import annotations

import json
from typing import Any
from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings

from .client import RedisClient

logger = get_logger(__name__)


class RedisCacheManager(BaseModel):
    """
    Redis Cache Manager for handling caching operations.
    """

    settings: Settings
    _client: Optional[RedisClient] = None

    @property
    def client(self) -> RedisClient:
        """Lazy loading Redis client."""
        if self._client is None:
            self._client = RedisClient(settings=self.settings)
        return self._client

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialize: bool = True,
    ) -> bool:
        """
        Set a key-value pair with optional TTL.

        Args:
            key: Cache key
            value: Value to store
            ttl: Time-to-live in seconds (default: settings.redis.ttl_seconds)
            serialize: Whether to serialize value as JSON

        Returns:
            bool: True if successful
        """
        try:
            redis_client = await self.client.get_client()

            # Serialize value if needed
            if serialize:
                if isinstance(value, (dict, list)):
                    stored_value = json.dumps(value)
                else:
                    stored_value = str(value)
            else:
                stored_value = value

            # Use default TTL if not specified
            ttl_to_use = ttl or self.settings.redis.ttl_seconds

            # Set with TTL
            result = await redis_client.setex(key, ttl_to_use, stored_value)

            logger.debug(f"Set cache key: {key} (TTL: {ttl_to_use}s)")
            return result is True

        except Exception as e:
            logger.error(f"Failed to set Redis key {key}: {str(e)}")
            return False

    async def get(
        self,
        key: str,
        deserialize: bool = True,
        default: Any = None,
    ) -> Any:
        """
        Get value by key.

        Args:
            key: Cache key
            deserialize: Whether to deserialize JSON value
            default: Default value if key not found

        Returns:
            Any: Cached value or default
        """
        try:
            redis_client = await self.client.get_client()
            value = await redis_client.get(key)

            if value is None:
                return default

            # Deserialize if needed
            if deserialize:
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    # Return as string if JSON parsing fails
                    return value
            else:
                return value

        except Exception as e:
            logger.error(f"Failed to get Redis key {key}: {str(e)}")
            return default

    async def delete(self, *keys: str) -> int:
        """
        Delete one or more keys.

        Args:
            keys: Keys to delete

        Returns:
            int: Number of keys deleted
        """
        try:
            redis_client = await self.client.get_client()
            result = await redis_client.delete(*keys)
            logger.debug(f"Deleted {result} keys: {keys}")
            return result
        except Exception as e:
            logger.error(f"Failed to delete Redis keys {keys}: {str(e)}")
            return 0

    async def exists(self, *keys: str) -> int:
        """
        Check if keys exist.

        Args:
            keys: Keys to check

        Returns:
            int: Number of keys that exist
        """
        try:
            redis_client = await self.client.get_client()
            return await redis_client.exists(*keys)
        except Exception as e:
            logger.error(
                f"Failed to check Redis keys existence {keys}: {str(e)}",
            )
            return 0

    async def expire(self, key: str, seconds: int) -> bool:
        """
        Set TTL for a key.

        Args:
            key: Cache key
            seconds: TTL in seconds

        Returns:
            bool: True if successful
        """
        try:
            redis_client = await self.client.get_client()
            result = await redis_client.expire(key, seconds)
            return result is True
        except Exception as e:
            logger.error(f"Failed to set TTL for Redis key {key}: {str(e)}")
            return False

    async def get_keys_by_pattern(self, pattern: str) -> List[str]:
        """
        Get keys matching a pattern.

        Args:
            pattern: Redis key pattern (e.g., "api:*")

        Returns:
            List[str]: List of matching keys
        """
        try:
            redis_client = await self.client.get_client()
            keys = await redis_client.keys(pattern)
            return [key.decode() if isinstance(key, bytes) else key for key in keys]
        except Exception as e:
            logger.error(
                f"Failed to get Redis keys with pattern {pattern}: {str(e)}",
            )
            return []

    async def clear_cache_by_pattern(self, pattern: str) -> int:
        """
        Clear cache keys matching pattern.

        Args:
            pattern: Redis key pattern

        Returns:
            int: Number of keys deleted
        """
        try:
            keys = await self.get_keys_by_pattern(pattern)
            if keys:
                return await self.delete(*keys)
            return 0
        except Exception as e:
            logger.error(
                f"Failed to clear cache by pattern {pattern}: {str(e)}",
            )
            return 0
