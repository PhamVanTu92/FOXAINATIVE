"""
Default configuration values for the application.
Change these values to update defaults across the entire application.
"""
from __future__ import annotations


class DefaultProviders:
    """Default provider settings for the application"""

    # Embedding provider: "openai" | "claude" | "gemini" | "foxaillm"
    EMBEDDING: str = 'gemini'

    # Storage provider: "qdrant"
    STORAGE: str = 'qdrant'

    # LLM provider: "openai" | "claude" | "gemini" | "foxaillm"
    LLM: str = 'gemini'

    # Collection name
    COLLECTION: str = 'foxai_native_default'


class DefaultChunkerConfig:
    """Default chunker configuration for markdown and text processing"""

    # Chunk size in characters (for HierarchicalMarkdownChunker)
    CHUNK_SIZE: int = 700

    # Overlap between chunks in characters
    CHUNK_OVERLAP: int = 100


# For backward compatibility and easy imports
DEFAULT_EMBEDDING_PROVIDER = DefaultProviders.EMBEDDING
DEFAULT_STORAGE_PROVIDER = DefaultProviders.STORAGE
DEFAULT_LLM_PROVIDER = DefaultProviders.LLM
DEFAULT_COLLECTION = DefaultProviders.COLLECTION

DEFAULT_CHUNK_SIZE = DefaultChunkerConfig.CHUNK_SIZE
DEFAULT_CHUNK_OVERLAP = DefaultChunkerConfig.CHUNK_OVERLAP
