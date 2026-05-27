from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings.defaults import DEFAULT_LLM_PROVIDER
from joint.settings.settings import Settings
from langchain_core.language_models.chat_models import BaseChatModel

from .llm_providers.base import BaseLLMInput
from .llm_providers.base import BaseLLMOutput
from .llm_providers.claude import ClaudeProvider
from .llm_providers.foxaillm import FoxAILLMProvider
from .llm_providers.gemini import GeminiProvider
from .llm_providers.openai import OpenAIProvider

logger = get_logger(__name__)


class LLMInput(BaseModel):
    base_llm_input: Optional[BaseLLMInput] = None
    provider_name: str = DEFAULT_LLM_PROVIDER


class LLMOutput(BaseModel):
    base_llm_output: BaseLLMOutput


class LLMService(BaseService):
    """Service for processing LLM requests."""
    settings: Settings

    @property
    def available_providers(self) -> list[str]:
        """Get available providers."""
        return ['openai', 'claude', 'gemini', 'foxaillm']

    @property
    def openai_provider(self) -> OpenAIProvider:
        """Get OpenAI provider instance."""
        return OpenAIProvider(settings=self.settings.openai)

    @property
    def claude_provider(self) -> ClaudeProvider:
        """Get Claude provider instance."""
        return ClaudeProvider(settings=self.settings.claude)

    @property
    def gemini_provider(self) -> GeminiProvider:
        """Get Gemini provider instance."""
        return GeminiProvider(settings=self.settings.gemini)

    @property
    def foxaillm_provider(self) -> FoxAILLMProvider:
        """Get FoxAI LLM provider instance."""
        return FoxAILLMProvider(settings=self.settings.foxaillm)

    def process(self, input: LLMInput) -> LLMOutput:
        """Process LLM input using specified or current provider."""

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

        logger.info(f"Using provider: {provider.provider_type}")

        # Handle case when base_llm_input is None
        if input.base_llm_input is None:
            base_llm_input = BaseLLMInput()
        else:
            base_llm_input = input.base_llm_input

        base_llm_output = provider.process(base_llm_input)

        # Return LLMOutput with base_llm_output field
        return LLMOutput(base_llm_output=base_llm_output)

    def client(self, input: LLMInput) -> BaseChatModel:
        """Get LLM provider client by name."""
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

        logger.info(f"Using LLM provider: {provider.provider_type}")
        return provider.client
