from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import OpenAISettings
from langchain.schema.messages import HumanMessage
from langchain_openai import ChatOpenAI

from .base import BaseLLMVisionProvider
from .base import LLMVisionInput
from .base import LLMVisionOutput
from .base import LLMVisionProviderType

logger = get_logger(__name__)

# Module-level singleton
_client: Optional[ChatOpenAI] = None


class OpenAIVisionProvider(BaseLLMVisionProvider, BaseModel):
    """OpenAI Vision LLM provider with module-level singleton client."""

    settings: OpenAISettings

    @property
    def provider_type(self) -> LLMVisionProviderType:
        return LLMVisionProviderType.OPENAI_VISION

    @property
    def client(self) -> ChatOpenAI:
        """Get singleton ChatOpenAI client for vision tasks."""
        global _client

        if _client is None:
            logger.info('Initializing OpenAI Vision LLM client')
            _client = ChatOpenAI(
                api_key=self.settings.api_key,
                model=self.settings.model_name,
                temperature=self.settings.temperature,
                max_tokens=self.settings.max_output_tokens,
                request_timeout=self.settings.request_timeout,
                max_retries=self.settings.max_retries,
            )
            logger.info('OpenAI Vision LLM client initialized')

        return _client

    @staticmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        global _client
        if _client is not None:
            logger.info('Resetting OpenAI Vision LLM client')
            _client = None

    async def process(self, input: LLMVisionInput) -> LLMVisionOutput:
        """Analyze image using LangChain ChatOpenAI with vision."""
        try:
            # Build message with image URL (since images are already public)
            message = HumanMessage(
                content=[
                    {'type': 'text', 'text': input.prompt},
                    {'type': 'image_url', 'image_url': {'url': input.image_url}},
                ],
            )

            # Get response
            client = self.client
            response = await client.ainvoke([message])
            description = response.content.strip()

            logger.info(f"OpenAI Vision generated description: {description}")

            return LLMVisionOutput(
                description=description,
            )

        except Exception as e:
            logger.error(f"OpenAI Vision analysis failed: {e}")
            # Return fallback description
            fallback_desc = 'Image content'
            if input.context:
                fallback_desc = input.context.get(
                    'image_alt_text', 'Image content',
                )
            return LLMVisionOutput(
                description=fallback_desc,
            )
