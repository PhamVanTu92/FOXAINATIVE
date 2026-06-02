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
            logger.info('Initializing Gemini Embeddings client')
            # Gemini API requires the model name in the "models/<id>" form;
            # a bare id (e.g. from a stale env or the default) yields a
            # 400 "BatchEmbedContentsRequest.model: unexpected model name format".
            model = self.settings.embedding_model
            if not model.startswith(('models/', 'tunedModels/')):
                model = f'models/{model}'
            _client = GoogleGenerativeAIEmbeddings(
                google_api_key=self.settings.api_key,
                model=model,
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
