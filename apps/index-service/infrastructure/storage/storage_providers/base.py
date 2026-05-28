from __future__ import annotations

from abc import ABC
from abc import abstractmethod
from enum import Enum
from typing import Any

from joint.logging.logger import get_logger

logger = get_logger(__name__)


class StorageProviderType(str, Enum):
    """Enumeration of supported storage providers."""
    QDRANT = 'qdrant'


class BaseStorageProvider(ABC):
    """Abstract base class for all storage providers.

    Each provider implementation should use module-level singleton
    for client connection to prevent repeated initialization.
    """

    @property
    @abstractmethod
    def provider_type(self) -> StorageProviderType:
        """Return the provider type."""
        pass

    @property
    @abstractmethod
    def client(self) -> Any:
        """Return the storage client instance (singleton)."""
        pass

    @staticmethod
    @abstractmethod
    def reset_client() -> None:
        """Reset singleton client instance for cleanup."""
        pass
