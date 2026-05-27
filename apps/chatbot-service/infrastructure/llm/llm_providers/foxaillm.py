from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import FoxAILLMSettings
from langchain_openai import ChatOpenAI

from .base import BaseLLMProvider
from .base import LLMProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[ChatOpenAI] = None


class FoxAILLMProvider(BaseLLMProvider, BaseModel):
    """FoxAI LLM provider with module-level singleton client."""

    settings: FoxAILLMSettings

    @property
    def provider_type(self) -> LLMProviderType:
        return LLMProviderType.FOXAILLM

    @property
    def client(self) -> ChatOpenAI:
        """Get singleton ChatOpenAI client."""
        global _client

        if _client is None:
            logger.info('Initializing FoxAI LLM client')
            _client = ChatOpenAI(
                api_key=self.settings.api_key,
                base_url=self.settings.base_url,
                model=self.settings.model_name,
                temperature=self.settings.temperature,
                streaming=self.settings.streaming,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
                max_tokens=self.settings.max_output_tokens,
                model_kwargs={
                    'extra_body': {'chat_template_kwargs': {'enable_thinking': False}},
                },
            )
            logger.info('FoxAI LLM client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting FoxAI LLM client')
            _client = None
