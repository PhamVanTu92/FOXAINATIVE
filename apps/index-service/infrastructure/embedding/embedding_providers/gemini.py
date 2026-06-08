from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import GeminiSettings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from .base import BaseEmbeddingProvider
from .base import EmbeddingProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[GoogleGenerativeAIEmbeddings] = None


class GeminiEmbeddingProvider(BaseEmbeddingProvider, BaseModel):
    """Gemini (Google) embedding provider with module-level singleton client."""

    settings: GeminiSettings

    @property
    def provider_type(self) -> EmbeddingProviderType:
        return EmbeddingProviderType.GEMINI

    @property
    def client(self) -> GoogleGenerativeAIEmbeddings:
        """Get singleton Gemini embeddings client."""
        global _client

        if _client is None:
            # The Gemini API expects the fully-qualified resource name
            # (e.g. 'models/gemini-embedding-001'). Without the 'models/'
            # prefix the BatchEmbedContents call returns HTTP 400
            # "unexpected model name format", failing every upload at the
            # embedding step. Normalize here so the .env value can be set
            # either with or without the prefix.
            model_name = self.settings.embedding_model
            if not model_name.startswith(('models/', 'tunedModels/')):
                model_name = f'models/{model_name}'

            logger.info(f'Initializing Gemini Embeddings client (model: {model_name})')
            _client = GoogleGenerativeAIEmbeddings(
                google_api_key=self.settings.api_key,
                model=model_name,
            )
            logger.info('Gemini Embeddings client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting Gemini Embeddings client')
            _client = None
