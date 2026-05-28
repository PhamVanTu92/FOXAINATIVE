from __future__ import annotations

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.settings import Settings
from langchain_core.embeddings import Embeddings

from .embedding_providers.claude import ClaudeEmbeddingProvider
from .embedding_providers.foxaillm import FoxAILLMEmbeddingProvider
from .embedding_providers.gemini import GeminiEmbeddingProvider
from .embedding_providers.openai import OpenAIEmbeddingProvider

logger = get_logger(__name__)


class BaseEmbeddingInput(BaseModel):
    provider_name: str = DEFAULT_EMBEDDING_PROVIDER


class EmbeddingService(BaseService):
    """Service for processing embedding requests."""
    settings: Settings

    @property
    def available_providers(self) -> list[str]:
        """Get available providers."""
        return ['openai', 'claude', 'gemini', 'foxaillm']

    @property
    def openai_provider(self) -> OpenAIEmbeddingProvider:
        """Get OpenAI embedding provider instance."""
        return OpenAIEmbeddingProvider(settings=self.settings.openai)

    @property
    def claude_provider(self) -> ClaudeEmbeddingProvider:
        """Get Claude embedding provider instance."""
        return ClaudeEmbeddingProvider(settings=self.settings.claude)

    @property
    def gemini_provider(self) -> GeminiEmbeddingProvider:
        """Get Gemini embedding provider instance."""
        return GeminiEmbeddingProvider(settings=self.settings.gemini)

    @property
    def foxaillm_provider(self) -> FoxAILLMEmbeddingProvider:
        """Get FoxAI LLM embedding provider instance."""
        return FoxAILLMEmbeddingProvider(settings=self.settings.foxaillm)

    def process(self, input: BaseEmbeddingInput) -> Embeddings:
        """Get embedding provider by name."""
        provider_name = input.provider_name
        if provider_name == 'openai':
            provider = self.openai_provider
        elif provider_name == 'claude':
            provider = self.claude_provider
        elif provider_name == 'gemini':
            provider = self.gemini_provider
        elif provider_name == 'foxaillm':
            provider = self.foxaillm_provider
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")

        logger.info(f"Using embedding provider: {provider.provider_type}")
        return provider.client
