from __future__ import annotations

from abc import ABC
from abc import abstractmethod
from enum import Enum
from typing import Any

from joint.logging.logger import get_logger

logger = get_logger(__name__)


class EmbeddingProviderType(str, Enum):
    """Enumeration of supported embedding providers."""
    OPENAI = 'openai'
    CLAUDE = 'claude'
    GEMINI = 'gemini'
    FOXAILLM = 'foxaillm'


class BaseEmbeddingProvider(ABC):
    """Abstract base class for all embedding providers.

    Each provider implementation should use module-level singleton
    for client to prevent repeated initialization.
    """

    @property
    @abstractmethod
    def provider_type(self) -> EmbeddingProviderType:
        """Return the provider type."""
        pass

    @property
    @abstractmethod
    def client(self) -> Any:
        """Return the embedding client instance (singleton)."""
        pass

    @staticmethod
    @abstractmethod
    def reset_client() -> None:
        """Reset singleton client instance for cleanup."""
        pass
