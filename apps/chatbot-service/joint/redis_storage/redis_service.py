from __future__ import annotations

from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings

from .redis.cache_manager import RedisCacheManager
from .redis.client import RedisClient
from .redis.data_processor import RedisDataProcessor
from .redis.session_manager import RedisSessionManager

logger = get_logger(__name__)


class RedisService(BaseModel):
    """
    Main Redis service that orchestrates all Redis operations.
    This is a facade that delegates to specialized components.
    """

    settings: Settings

    # Private attributes for caching
    _client = None
    _cache_manager = None
    _session_manager = None
    _data_processor = None

    @property
    def client(self) -> RedisClient:
        """Lazy loading client with caching"""
        if self._client is None:
            self._client = RedisClient(settings=self.settings)
        return self._client

    @property
    def cache_manager(self) -> RedisCacheManager:
        """Lazy loading cache manager with caching"""
        if self._cache_manager is None:
            self._cache_manager = RedisCacheManager(settings=self.settings)
        return self._cache_manager

    @property
    def session_manager(self) -> RedisSessionManager:
        """Lazy loading session manager with caching"""
        if self._session_manager is None:
            self._session_manager = RedisSessionManager(settings=self.settings)
        return self._session_manager

    @property
    def data_processor(self) -> RedisDataProcessor:
        """Lazy loading data processor with caching"""
        if self._data_processor is None:
            self._data_processor = RedisDataProcessor(settings=self.settings)
        return self._data_processor

    # =============================================
    # CLIENT OPERATIONS
    # =============================================

    async def ping(self) -> bool:
        """Test Redis connection."""
        return await self.client.ping()

    async def get_redis_info(self) -> Dict[str, Any]:
        """Get Redis server information."""
        return await self.client.info()

    async def close(self) -> None:
        """Close Redis connections."""
        await self.client.close()

    # =============================================
    # CACHE OPERATIONS
    # =============================================

    async def set_cache(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialize: bool = True,
    ) -> bool:
        """Set cache value."""
        return await self.cache_manager.set(key, value, ttl, serialize)

    async def get_cache(
        self,
        key: str,
        deserialize: bool = True,
        default: Any = None,
    ) -> Any:
        """Get cache value."""
        return await self.cache_manager.get(key, deserialize, default)

    async def delete_cache(self, *keys: str) -> int:
        """Delete cache keys."""
        return await self.cache_manager.delete(*keys)

    async def cache_exists(self, *keys: str) -> int:
        """Check if cache keys exist."""
        return await self.cache_manager.exists(*keys)

    async def set_cache_ttl(self, key: str, seconds: int) -> bool:
        """Set TTL for cache key."""
        return await self.cache_manager.expire(key, seconds)

    async def get_cache_keys(self, pattern: str) -> List[str]:
        """Get cache keys by pattern."""
        return await self.cache_manager.get_keys_by_pattern(pattern)

    async def clear_cache_pattern(self, pattern: str) -> int:
        """Clear cache by pattern."""
        return await self.cache_manager.clear_cache_by_pattern(pattern)

    # =============================================
    # SESSION OPERATIONS
    # =============================================

    async def create_session(
        self,
        session_id: str,
        user_data: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        """Create user session."""
        return await self.session_manager.create_session(session_id, user_data, ttl)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get user session."""
        return await self.session_manager.get_session(session_id)

    async def update_session(
        self,
        session_id: str,
        user_data: Dict[str, Any],
        extend_ttl: bool = True,
    ) -> bool:
        """Update user session."""
        return await self.session_manager.update_session(session_id, user_data, extend_ttl)

    async def delete_session(self, session_id: str) -> bool:
        """Delete user session."""
        return await self.session_manager.delete_session(session_id)

    async def extend_session(self, session_id: str, ttl: Optional[int] = None) -> bool:
        """Extend session TTL."""
        return await self.session_manager.extend_session(session_id, ttl)

    async def get_active_sessions(self) -> List[str]:
        """Get active session IDs."""
        return await self.session_manager.get_active_sessions()

    # =============================================
    # DATA PROCESSING OPERATIONS
    # =============================================

    async def cache_api_response(
        self,
        api_endpoint: str,
        params: Dict[str, Any],
        response_data: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """Cache API response."""
        return await self.data_processor.cache_api_response(api_endpoint, params, response_data, ttl)

    async def get_cached_api_response(
        self,
        api_endpoint: str,
        params: Dict[str, Any],
    ) -> Optional[Any]:
        """Get cached API response."""
        return await self.data_processor.get_cached_api_response(api_endpoint, params)

    async def cache_aggregation(
        self,
        aggregation_type: str,
        filters: Dict[str, Any],
        result: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """Cache aggregation result."""
        return await self.data_processor.cache_aggregation(aggregation_type, filters, result, ttl)

    async def get_cached_aggregation(
        self,
        aggregation_type: str,
        filters: Dict[str, Any],
    ) -> Optional[Any]:
        """Get cached aggregation result."""
        return await self.data_processor.get_cached_aggregation(aggregation_type, filters)

    async def cache_erp_data(
        self,
        table_name: str,
        query_params: Dict[str, Any],
        data: List[Dict[str, Any]],
        ttl: Optional[int] = None,
    ) -> bool:
        """Cache ERP data."""
        return await self.data_processor.cache_erp_data(table_name, query_params, data, ttl)

    async def get_cached_erp_data(
        self,
        table_name: str,
        query_params: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Get cached ERP data."""
        return await self.data_processor.get_cached_erp_data(table_name, query_params)

    async def clear_erp_cache(self, table_name: Optional[str] = None) -> int:
        """Clear ERP cache."""
        return await self.data_processor.clear_erp_cache(table_name)
