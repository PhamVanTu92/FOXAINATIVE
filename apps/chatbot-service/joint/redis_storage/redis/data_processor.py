"""Redis Data Processor for handling complex data operations."""
from __future__ import annotations

import json
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings
from pydantic import Field

from .client import RedisClient

logger = get_logger(__name__)


class RedisError(Exception):
    """Custom exception for Redis operations."""
    pass


class RedisInput(BaseModel):
    """Input model for Redis operations."""

    key: str = Field(description='Redis key')
    value: Any = Field(description='Value to store')
    ttl: Optional[int] = Field(
        default=None, description='Time-to-live in seconds',
    )
    serialize: bool = Field(
        default=True, description='Whether to serialize value',
    )


class RedisDataProcessor(BaseModel):
    """
    Redis Data Processor for handling complex data operations like aggregations and API caching.
    """

    settings: Settings
    _client: Optional[RedisClient] = None

    @property
    def client(self) -> RedisClient:
        """Lazy loading Redis client."""
        if self._client is None:
            self._client = RedisClient(settings=self.settings)
        return self._client

    async def cache_api_response(
        self,
        api_endpoint: str,
        params: Dict[str, Any],
        response_data: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Cache API response data.

        Args:
            api_endpoint: API endpoint name
            params: Request parameters
            response_data: API response to cache
            ttl: Cache TTL in seconds

        Returns:
            bool: True if cached successfully
        """
        try:
            # Create cache key from endpoint and params
            params_str = json.dumps(params, sort_keys=True)
            cache_key = f"api:{api_endpoint}:{hash(params_str)}"

            redis_client = await self.client.get_client()
            stored_value = json.dumps(response_data)
            ttl_to_use = ttl or self.settings.redis.ttl_seconds

            result = await redis_client.setex(cache_key, ttl_to_use, stored_value)

            logger.debug(
                f"Cached API response: {api_endpoint} with params {params}",
            )
            return result is True

        except Exception as e:
            logger.error(
                f"Failed to cache API response for {api_endpoint}: {str(e)}",
            )
            return False

    async def get_cached_api_response(
        self,
        api_endpoint: str,
        params: Dict[str, Any],
    ) -> Optional[Any]:
        """
        Get cached API response.

        Args:
            api_endpoint: API endpoint name
            params: Request parameters

        Returns:
            Optional[Any]: Cached response or None
        """
        try:
            # Create cache key from endpoint and params
            params_str = json.dumps(params, sort_keys=True)
            cache_key = f"api:{api_endpoint}:{hash(params_str)}"

            redis_client = await self.client.get_client()
            cached_data = await redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"Cache hit for API: {api_endpoint}")
                return json.loads(cached_data)

            logger.debug(f"Cache miss for API: {api_endpoint}")
            return None

        except Exception as e:
            logger.error(
                f"Failed to get cached API response for {api_endpoint}: {str(e)}",
            )
            return None

    async def cache_aggregation(
        self,
        aggregation_type: str,
        filters: Dict[str, Any],
        result: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Cache aggregated data results.

        Args:
            aggregation_type: Type of aggregation (e.g., "inventory_summary")
            filters: Filters used for aggregation
            result: Aggregation result
            ttl: Cache TTL in seconds

        Returns:
            bool: True if cached successfully
        """
        try:
            filters_str = json.dumps(filters, sort_keys=True)
            cache_key = f"agg:{aggregation_type}:{hash(filters_str)}"

            redis_client = await self.client.get_client()
            stored_value = json.dumps(result)
            ttl_to_use = ttl or self.settings.redis.ttl_seconds

            result = await redis_client.setex(cache_key, ttl_to_use, stored_value)

            logger.debug(
                f"Cached aggregation: {aggregation_type} with filters {filters}",
            )
            return result is True

        except Exception as e:
            logger.error(
                f"Failed to cache aggregation {aggregation_type}: {str(e)}",
            )
            return False

    async def get_cached_aggregation(
        self,
        aggregation_type: str,
        filters: Dict[str, Any],
    ) -> Optional[Any]:
        """
        Get cached aggregation result.

        Args:
            aggregation_type: Type of aggregation
            filters: Filters used for aggregation

        Returns:
            Optional[Any]: Cached result or None
        """
        try:
            filters_str = json.dumps(filters, sort_keys=True)
            cache_key = f"agg:{aggregation_type}:{hash(filters_str)}"

            redis_client = await self.client.get_client()
            cached_data = await redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"Cache hit for aggregation: {aggregation_type}")
                return json.loads(cached_data)

            logger.debug(f"Cache miss for aggregation: {aggregation_type}")
            return None

        except Exception as e:
            logger.error(
                f"Failed to get cached aggregation {aggregation_type}: {str(e)}",
            )
            return None

    async def cache_erp_data(
        self,
        table_name: str,
        query_params: Dict[str, Any],
        data: List[Dict[str, Any]],
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Cache ERP data (OITM, OINM, OINV) with smart key generation.

        Args:
            table_name: ERP table name (oitm, oinm, oinv)
            query_params: Query parameters used to fetch data
            data: ERP data to cache
            ttl: Cache TTL in seconds

        Returns:
            bool: True if cached successfully
        """
        try:
            # Create smart cache key for ERP data
            params_str = json.dumps(query_params, sort_keys=True)
            cache_key = f"erp:{table_name}:{hash(params_str)}"

            redis_client = await self.client.get_client()
            stored_value = json.dumps({
                'data': data,
                'total': len(data),
                'query_params': query_params,
                'table': table_name,
            })

            ttl_to_use = ttl or self.settings.redis.ttl_seconds
            result = await redis_client.setex(cache_key, ttl_to_use, stored_value)

            logger.debug(
                f"Cached ERP data: {table_name} ({len(data)} records)",
            )
            return result is True

        except Exception as e:
            logger.error(
                f"Failed to cache ERP data for {table_name}: {str(e)}",
            )
            return False

    async def get_cached_erp_data(
        self,
        table_name: str,
        query_params: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached ERP data.

        Args:
            table_name: ERP table name (oitm, oinm, oinv)
            query_params: Query parameters used to fetch data

        Returns:
            Optional[Dict[str, Any]]: Cached ERP data or None
        """
        try:
            # Create cache key
            params_str = json.dumps(query_params, sort_keys=True)
            cache_key = f"erp:{table_name}:{hash(params_str)}"

            redis_client = await self.client.get_client()
            cached_data = await redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"Cache hit for ERP data: {table_name}")
                return json.loads(cached_data)

            logger.debug(f"Cache miss for ERP data: {table_name}")
            return None

        except Exception as e:
            logger.error(
                f"Failed to get cached ERP data for {table_name}: {str(e)}",
            )
            return None

    async def clear_erp_cache(self, table_name: Optional[str] = None) -> int:
        """
        Clear ERP cache by table name or all ERP cache.

        Args:
            table_name: Specific table to clear, or None for all

        Returns:
            int: Number of keys deleted
        """
        try:
            if table_name:
                pattern = f"erp:{table_name}:*"
            else:
                pattern = 'erp:*'

            redis_client = await self.client.get_client()
            keys = await redis_client.keys(pattern)

            if keys:
                result = await redis_client.delete(*keys)
                logger.debug(
                    f"Cleared {result} ERP cache keys for pattern: {pattern}",
                )
                return result

            return 0

        except Exception as e:
            logger.error(f"Failed to clear ERP cache: {str(e)}")
            return 0
