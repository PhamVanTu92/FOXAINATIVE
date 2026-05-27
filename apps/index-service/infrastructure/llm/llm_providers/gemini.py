from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import GeminiSettings
from langchain_google_genai import ChatGoogleGenerativeAI

from .base import BaseLLMProvider
from .base import LLMProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[ChatGoogleGenerativeAI] = None


class GeminiProvider(BaseLLMProvider, BaseModel):
    """Gemini LLM provider with module-level singleton client."""

    settings: GeminiSettings

    @property
    def provider_type(self) -> LLMProviderType:
        return LLMProviderType.GEMINI

    @property
    def client(self) -> ChatGoogleGenerativeAI:
        """Get singleton ChatGoogleGenerativeAI client."""
        global _client

        if _client is None:
            logger.info('Initializing Gemini LLM client')
            _client = ChatGoogleGenerativeAI(
                google_api_key=self.settings.api_key,
                model=self.settings.model_name,
                temperature=self.settings.temperature,
                disable_streaming=self.settings.streaming,
                timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
                max_output_tokens=self.settings.max_output_tokens,
            )
            logger.info('Gemini LLM client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting Gemini LLM client')
            _client = None
