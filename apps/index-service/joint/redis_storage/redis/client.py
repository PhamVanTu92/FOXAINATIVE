"""Redis Client for connection management."""
from __future__ import annotations

from typing import Optional

import redis.asyncio as aioredis
from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings
from redis.exceptions import ConnectionError
from redis.exceptions import TimeoutError

logger = get_logger(__name__)


class RedisConnectionError(Exception):
    """Custom exception for Redis connection issues."""
    pass


class RedisClient(BaseModel):
    """
    Redis client wrapper for managing connections and basic operations.
    """

    settings: Settings
    _redis_client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        """
        Get or create Redis client with connection pooling.

        Returns:
            aioredis.Redis: Redis client instance

        Raises:
            RedisConnectionError: If connection fails
        """
        if self._redis_client is None:
            try:
                redis_settings = self.settings.redis

                # Build connection pool parameters
                pool_params = {
                    'host': redis_settings.host,
                    'port': redis_settings.port,
                    'db': redis_settings.database,
                    'socket_timeout': redis_settings.socket_timeout,
                    'socket_connect_timeout': redis_settings.connection_timeout,
                    'max_connections': redis_settings.max_connections,
                    'retry_on_timeout': redis_settings.retry_on_timeout,
                    'decode_responses': redis_settings.decode_responses,
                }

                # Add optional parameters only if they exist and are not empty
                if redis_settings.password and redis_settings.password.strip():
                    pool_params['password'] = redis_settings.password

                # Only add SSL if enabled and not using localhost/127.0.0.1
                if (
                    redis_settings.ssl and
                    redis_settings.host not in ['localhost', '127.0.0.1'] and
                    hasattr(aioredis.ConnectionPool, '__init__')
                ):
                    try:
                        # Test if SSL parameter is supported
                        pool_params['ssl'] = redis_settings.ssl
                    except Exception:
                        # If SSL parameter causes issues, skip it for local development
                        logger.warning(
                            'SSL parameter not supported, skipping SSL configuration',
                        )

                # Create connection pool
                connection_pool = aioredis.ConnectionPool(**pool_params)

                # Create Redis client
                self._redis_client = aioredis.Redis(
                    connection_pool=connection_pool,
                )

                # Test connection
                await self._redis_client.ping()
                logger.info(
                    f"Successfully connected to Redis at {redis_settings.host}:{redis_settings.port}",
                )

            except (ConnectionError, TimeoutError) as e:
                error_msg = f"Failed to connect to Redis: {str(e)}"
                logger.error(error_msg)
                raise RedisConnectionError(error_msg) from e
            except Exception as e:
                error_msg = f"Unexpected Redis error: {str(e)}"
                logger.error(error_msg)
                raise RedisConnectionError(error_msg) from e

        return self._redis_client

    async def close(self) -> None:
        """Close Redis connection pool."""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
            logger.info('Redis connection closed')

    async def ping(self) -> bool:
        """
        Test Redis connection.

        Returns:
            bool: True if connection is healthy
        """
        try:
            client = await self.get_client()
            result = await client.ping()
            return result is True
        except Exception as e:
            logger.error(f"Redis ping failed: {str(e)}")
            return False

    async def info(self) -> dict:
        """
        Get Redis server information.

        Returns:
            dict: Redis server information
        """
        try:
            client = await self.get_client()
            info = await client.info()

            return {
                'redis_version': info.get('redis_version'),
                'connected_clients': info.get('connected_clients'),
                'used_memory': info.get('used_memory_human'),
                'used_memory_peak': info.get('used_memory_peak_human'),
                'keyspace_hits': info.get('keyspace_hits'),
                'keyspace_misses': info.get('keyspace_misses'),
                'total_commands_processed': info.get('total_commands_processed'),
                'uptime': info.get('uptime_in_seconds'),
            }
        except Exception as e:
            logger.error(f"Failed to get Redis info: {str(e)}")
            return {}
