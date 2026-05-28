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


# For backward compatibility and easy imports
DEFAULT_EMBEDDING_PROVIDER = DefaultProviders.EMBEDDING
DEFAULT_STORAGE_PROVIDER = DefaultProviders.STORAGE
DEFAULT_LLM_PROVIDER = DefaultProviders.LLM
DEFAULT_COLLECTION = DefaultProviders.COLLECTION
