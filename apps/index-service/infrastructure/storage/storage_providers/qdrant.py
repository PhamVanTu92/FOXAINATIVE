from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings
from qdrant_client import QdrantClient

from .base import BaseStorageProvider
from .base import StorageProviderType


logger = get_logger(__name__)

# Module-level singleton instance
_qdrant_client: Optional[QdrantClient] = None
_client_host: Optional[str] = None


class QdrantStorageProvider(BaseStorageProvider, BaseModel):
    """Qdrant storage provider with module-level singleton client."""

    settings: Settings

    @property
    def provider_type(self) -> StorageProviderType:
        return StorageProviderType.QDRANT

    @property
    def client(self) -> QdrantClient:
        """Get singleton Qdrant client instance.

        Returns:
            QdrantClient: Singleton client object.
        """
        global _qdrant_client, _client_host

        current_host = self.settings.qdrant.host

        if _qdrant_client is None or _client_host != current_host:
            logger.info(f"Initializing Qdrant client: {current_host}")

            client_params = {'url': current_host}
            if self.settings.qdrant.api_key:
                client_params['api_key'] = self.settings.qdrant.api_key
                logger.info('Qdrant client with API key authentication')
            else:
                logger.info('Qdrant client local mode (no auth)')

            _qdrant_client = QdrantClient(**client_params)
            _client_host = current_host
            logger.info('Qdrant client initialized')

        return _qdrant_client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _qdrant_client, _client_host

        if _qdrant_client is not None:
            try:
                _qdrant_client.close()
                logger.info('Qdrant client closed')
            except Exception as e:
                logger.warning(f"Error closing Qdrant client: {e}")

        _qdrant_client = None
        _client_host = None
