from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import ClaudeSettings
from langchain_anthropic import ChatAnthropic

from .base import BaseLLMProvider
from .base import LLMProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[ChatAnthropic] = None


class ClaudeProvider(BaseLLMProvider, BaseModel):
    """Claude (Anthropic) LLM provider with module-level singleton client."""

    settings: ClaudeSettings

    @property
    def provider_type(self) -> LLMProviderType:
        return LLMProviderType.CLAUDE

    @property
    def client(self) -> ChatAnthropic:
        """Get singleton ChatAnthropic client."""
        global _client

        if _client is None:
            logger.info('Initializing Claude LLM client')
            _client = ChatAnthropic(
                api_key=self.settings.api_key,
                model=self.settings.model_name,
                temperature=self.settings.temperature,
                streaming=self.settings.streaming,
                timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
                max_tokens=self.settings.max_output_tokens,
            )
            logger.info('Claude LLM client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting Claude LLM client')
            _client = None
