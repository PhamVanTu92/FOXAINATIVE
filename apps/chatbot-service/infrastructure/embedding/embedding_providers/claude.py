from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import ClaudeSettings
from langchain_community.embeddings import VoyageEmbeddings

from .base import BaseEmbeddingProvider
from .base import EmbeddingProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[VoyageEmbeddings] = None


class ClaudeEmbeddingProvider(BaseEmbeddingProvider, BaseModel):
    """Claude (Anthropic) embedding provider with module-level singleton client."""

    settings: ClaudeSettings

    @property
    def provider_type(self) -> EmbeddingProviderType:
        return EmbeddingProviderType.CLAUDE

    @property
    def client(self) -> VoyageEmbeddings:
        """Get singleton Voyage AI embeddings client."""
        global _client

        if _client is None:
            logger.info('Initializing Claude (Voyage AI) Embeddings client')
            _client = VoyageEmbeddings(
                voyage_api_key=self.settings.api_key,
                model=self.settings.embedding_model,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
            )
            logger.info('Claude (Voyage AI) Embeddings client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting Claude Embeddings client')
            _client = None
