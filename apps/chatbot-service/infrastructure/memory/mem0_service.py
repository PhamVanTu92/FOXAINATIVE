"""Mem0 memory service for user personalization."""
from __future__ import annotations

import asyncio
from typing import Any
from typing import Dict
from typing import List

from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings

from .mem0_factory import Mem0Factory

logger = get_logger(__name__)


class Mem0MemoryService(BaseModel):
    """High-level service for Mem0 memory operations.

    Provides retrieve, store, and format capabilities with
    graceful degradation — failures never break the main chat flow.

    Attributes:
        settings: Application settings instance.
    """

    settings: Settings

    async def retrieve_memories(
        self,
        query: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant memories for a user query.

        Args:
            query: The user's current message text.
            user_id: Unique user identifier from JWT token.

        Returns:
            List of memory dicts with 'memory' and optional 'score' keys.
            Returns empty list on any failure (graceful degradation).
        """
        try:
            memory = await Mem0Factory.get_instance(self.settings)

            results = await asyncio.wait_for(
                memory.search(
                    query=query,
                    user_id=user_id,
                    limit=self.settings.mem0.max_memories,
                ),
                timeout=self.settings.mem0.retrieve_timeout,
            )

            # Normalize response format
            if isinstance(results, dict) and 'results' in results:
                memories = results['results']
            elif isinstance(results, list):
                memories = results
            else:
                memories = []

            # Filter by relevance threshold
            filtered = [
                mem for mem in memories
                if mem.get('score', 1.0) >= self.settings.mem0.relevance_threshold
            ]

            logger.info(
                f"Retrieved {len(filtered)}/{len(memories)} memories for user {user_id}",
                extra={'user_id': user_id, 'query_preview': query[:80]},
            )
            return filtered[:self.settings.mem0.max_memories]

        except asyncio.TimeoutError:
            logger.warning(
                f"Mem0 retrieve timed out for user {user_id}",
                extra={'timeout': self.settings.mem0.retrieve_timeout},
            )
            return []
        except Exception as e:
            logger.warning(
                f"Mem0 retrieve failed for user {user_id}: {e}",
                extra={'error_type': type(e).__name__},
            )
            return []

    async def store_interaction(
        self,
        user_message: str,
        ai_response: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Store a conversation turn in Mem0 for long-term personalization.

        Args:
            user_message: The user's message text.
            ai_response: The assistant's response text.
            user_id: Unique user identifier from JWT token.

        Returns:
            Dict with 'success' bool and optional 'count' of memories stored.
        """
        try:
            memory = await Mem0Factory.get_instance(self.settings)

            messages = [
                {'role': 'user', 'content': user_message},
                {'role': 'assistant', 'content': ai_response},
            ]

            result = await asyncio.wait_for(
                memory.add(messages, user_id=user_id),
                timeout=self.settings.mem0.store_timeout,
            )

            count = len(result.get('results', [])) if isinstance(
                result, dict,
            ) else 1
            logger.info(
                f"Stored {count} memories for user {user_id}",
                extra={'user_id': user_id},
            )
            return {'success': True, 'count': count}

        except asyncio.TimeoutError:
            logger.warning(
                f"Mem0 store timed out for user {user_id}",
                extra={'timeout': self.settings.mem0.store_timeout},
            )
            return {'success': False, 'count': 0}
        except Exception as e:
            logger.warning(
                f"Mem0 store failed for user {user_id}: {e}",
                extra={'error_type': type(e).__name__},
            )
            return {'success': False, 'count': 0}

    @staticmethod
    def format_memory_context(memories: List[Dict[str, Any]]) -> str:
        """Format retrieved memories into a context string for LLM injection.

        Args:
            memories: List of memory dicts from retrieve_memories().

        Returns:
            Formatted string ready for system prompt interpolation.
            Returns empty string if no memories available.
        """
        if not memories:
            return ''

        lines = ['Thông tin đã biết về người dùng từ các cuộc hội thoại trước:']
        for idx, mem in enumerate(memories, 1):
            text = mem.get('memory', '')
            score = mem.get('score')
            if score is not None:
                lines.append(f'{idx}. {text} (relevance: {score:.2f})')
            else:
                lines.append(f'{idx}. {text}')

        return '\n'.join(lines)
