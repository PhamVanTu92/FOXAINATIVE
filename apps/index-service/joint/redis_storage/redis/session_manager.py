"""Redis Session Manager for session management."""
from __future__ import annotations

import json
from typing import Any
from typing import Dict
from typing import Optional

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings

from .client import RedisClient

logger = get_logger(__name__)


class RedisSessionManager(BaseModel):
    """
    Redis Session Manager for handling user sessions and conversation state.
    """

    settings: Settings
    _client: Optional[RedisClient] = None

    @property
    def client(self) -> RedisClient:
        """Lazy loading Redis client."""
        if self._client is None:
            self._client = RedisClient(settings=self.settings)
        return self._client

    async def create_session(
        self,
        session_id: str,
        user_data: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Create a new user session.

        Args:
            session_id: Unique session identifier
            user_data: User session data
            ttl: Session TTL in seconds

        Returns:
            bool: True if session created successfully
        """
        try:
            redis_client = await self.client.get_client()

            session_key = f"session:{session_id}"
            session_data = json.dumps(user_data)

            ttl_to_use = ttl or self.settings.redis.ttl_seconds
            result = await redis_client.setex(session_key, ttl_to_use, session_data)

            logger.debug(f"Created session: {session_id}")
            return result is True

        except Exception as e:
            logger.error(f"Failed to create session {session_id}: {str(e)}")
            return False

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session data by session ID.

        Args:
            session_id: Session identifier

        Returns:
            Optional[Dict[str, Any]]: Session data or None
        """
        try:
            redis_client = await self.client.get_client()

            session_key = f"session:{session_id}"
            session_data = await redis_client.get(session_key)

            if session_data:
                return json.loads(session_data)
            return None

        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {str(e)}")
            return None

    async def update_session(
        self,
        session_id: str,
        user_data: Dict[str, Any],
        extend_ttl: bool = True,
    ) -> bool:
        """
        Update session data.

        Args:
            session_id: Session identifier
            user_data: Updated session data
            extend_ttl: Whether to reset TTL

        Returns:
            bool: True if session updated successfully
        """
        try:
            redis_client = await self.client.get_client()

            session_key = f"session:{session_id}"
            session_data = json.dumps(user_data)

            success = False
            if extend_ttl:
                success = bool(await redis_client.setex(session_key, self.settings.redis.ttl_seconds, session_data))
            else:
                success = bool(await redis_client.set(session_key, session_data))

            logger.debug(f"Updated session: {session_id}")
            return success

        except Exception as e:
            logger.error(f"Failed to update session {session_id}: {str(e)}")
            return False

    async def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.

        Args:
            session_id: Session identifier

        Returns:
            bool: True if session deleted successfully
        """
        try:
            redis_client = await self.client.get_client()

            session_key = f"session:{session_id}"
            result = await redis_client.delete(session_key)

            logger.debug(f"Deleted session: {session_id}")
            return result > 0

        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {str(e)}")
            return False

    async def extend_session(self, session_id: str, ttl: Optional[int] = None) -> bool:
        """
        Extend session TTL.

        Args:
            session_id: Session identifier
            ttl: New TTL in seconds

        Returns:
            bool: True if TTL extended successfully
        """
        try:
            redis_client = await self.client.get_client()

            session_key = f"session:{session_id}"
            ttl_to_use = ttl or self.settings.redis.ttl_seconds

            result = await redis_client.expire(session_key, ttl_to_use)
            return result is True

        except Exception as e:
            logger.error(f"Failed to extend session {session_id}: {str(e)}")
            return False

    async def get_active_sessions(self) -> list[str]:
        """
        Get list of active session IDs.

        Returns:
            list[str]: List of active session IDs
        """
        try:
            redis_client = await self.client.get_client()

            session_keys = await redis_client.keys('session:*')
            session_ids = []

            for key in session_keys:
                if isinstance(key, bytes):
                    key = key.decode()
                session_id = key.replace('session:', '')
                session_ids.append(session_id)

            return session_ids

        except Exception as e:
            logger.error(f"Failed to get active sessions: {str(e)}")
            return []
