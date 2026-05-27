from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import OpenAISettings
from langchain_openai import ChatOpenAI

from .base import BaseLLMProvider
from .base import LLMProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[ChatOpenAI] = None


class OpenAIProvider(BaseLLMProvider, BaseModel):
    """OpenAI LLM provider with module-level singleton client."""

    settings: OpenAISettings

    @property
    def provider_type(self) -> LLMProviderType:
        return LLMProviderType.OPENAI

    @property
    def client(self) -> ChatOpenAI:
        """Get singleton ChatOpenAI client."""
        global _client

        if _client is None:
            logger.info('Initializing OpenAI LLM client')
            _client = ChatOpenAI(
                api_key=self.settings.api_key,
                model=self.settings.model_name,
                temperature=self.settings.temperature,
                streaming=self.settings.streaming,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
                max_tokens=self.settings.max_output_tokens,
            )
            logger.info('OpenAI LLM client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting OpenAI LLM client')
            _client = None
