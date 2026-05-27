from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import OpenAISettings
from langchain_openai import OpenAIEmbeddings

from .base import BaseEmbeddingProvider
from .base import EmbeddingProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[OpenAIEmbeddings] = None


class OpenAIEmbeddingProvider(BaseEmbeddingProvider, BaseModel):
    """OpenAI embedding provider with module-level singleton client."""

    settings: OpenAISettings

    @property
    def provider_type(self) -> EmbeddingProviderType:
        return EmbeddingProviderType.OPENAI

    @property
    def client(self) -> OpenAIEmbeddings:
        """Get singleton OpenAI embeddings client."""
        global _client

        if _client is None:
            logger.info('Initializing OpenAI Embeddings client')
            _client = OpenAIEmbeddings(
                api_key=self.settings.api_key,
                model=self.settings.embedding_model,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
            )
            logger.info('OpenAI Embeddings client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting OpenAI Embeddings client')
            _client = None
