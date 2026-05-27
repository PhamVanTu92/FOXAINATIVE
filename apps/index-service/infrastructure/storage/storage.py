from __future__ import annotations

from typing import Any

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings.settings import Settings

from .storage_providers import QdrantStorageProvider

logger = get_logger(__name__)


class BaseStorageInput(BaseModel):
    provider_name: str = 'qdrant'


class StorageService(BaseService):
    """Service for processing storage requests."""
    settings: Settings

    @property
    def available_providers(self) -> list[str]:
        """Get available providers."""
        return ['qdrant']

    @property
    def qdrant_provider(self) -> QdrantStorageProvider:
        """Get Qdrant storage provider instance."""
        return QdrantStorageProvider(settings=self.settings)

    def process(self, input: BaseStorageInput) -> Any:
        """Get storage provider by name."""
        provider_name = input.provider_name
        if provider_name == 'qdrant':
            provider = self.qdrant_provider
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")

        logger.info(f"Using storage provider: {provider.provider_type}")
        return provider.client
