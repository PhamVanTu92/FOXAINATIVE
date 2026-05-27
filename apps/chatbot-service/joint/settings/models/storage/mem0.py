"""Mem0 personalization memory configuration settings."""
from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class Mem0Settings(BaseModel):
    """Mem0 long-term user memory configuration.

    Controls personalization memory powered by Mem0 AsyncMemory.
    Reuses existing Qdrant and OpenAI infrastructure.
    """

    enabled: bool = Field(
        True,
        description='Feature flag to enable/disable Mem0 personalization.',
    )
    collection_name: str = Field(
        'user_memory',
        description='Qdrant collection name for user memory vectors.',
    )
    max_memories: int = Field(
        5,
        description='Maximum number of memories to retrieve per query.',
    )
    relevance_threshold: float = Field(
        0.5,
        description='Minimum relevance score for memory inclusion (0.0-1.0).',
    )
    store_timeout: float = Field(
        30.0,
        description='Timeout in seconds for async memory store operations.',
    )
    retrieve_timeout: float = Field(
        10.0,
        description='Timeout in seconds for memory retrieval operations.',
    )
