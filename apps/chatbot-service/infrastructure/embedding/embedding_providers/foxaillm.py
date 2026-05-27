from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import FoxAILLMSettings
from langchain_openai import OpenAIEmbeddings

from .base import BaseEmbeddingProvider
from .base import EmbeddingProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[OpenAIEmbeddings] = None


class FoxAILLMEmbeddingProvider(BaseEmbeddingProvider, BaseModel):
    """FoxAI LLM embedding provider with module-level singleton client."""

    settings: FoxAILLMSettings

    @property
    def provider_type(self) -> EmbeddingProviderType:
        return EmbeddingProviderType.FOXAILLM

    @property
    def client(self) -> OpenAIEmbeddings:
        """Get singleton FoxAI LLM embeddings client."""
        global _client

        if _client is None:
            logger.info('Initializing FoxAI LLM Embeddings client')
            _client = OpenAIEmbeddings(
                api_key=self.settings.api_key,
                base_url=self.settings.base_url,
                model=self.settings.embedding_model,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
            )
            logger.info('FoxAI LLM Embeddings client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting FoxAI LLM Embeddings client')
            _client = None
