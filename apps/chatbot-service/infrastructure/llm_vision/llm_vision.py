from __future__ import annotations

from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings.settings import Settings

from .llm_vision_providers import LLMVisionInput
from .llm_vision_providers import LLMVisionOutput
from .llm_vision_providers.gemini import GeminiVisionProvider
from .llm_vision_providers.openai import OpenAIVisionProvider

logger = get_logger(__name__)


class VisionLLMInput(BaseModel):
    vision_input: Optional[LLMVisionInput] = None
    provider_name: str = 'openai-vision'


class VisionLLMOutput(BaseModel):
    vision_output: LLMVisionOutput


class VisionLLMService(BaseService):
    """Service for processing Vision LLM requests."""
    settings: Settings

    @property
    def available_providers(self) -> list[str]:
        """Get available vision providers."""
        return ['openai-vision', 'gemini-vision']

    @property
    def openai_vision_provider(self) -> OpenAIVisionProvider:
        """Get OpenAI Vision provider instance."""
        return OpenAIVisionProvider(settings=self.settings.openai)

    @property
    def gemini_vision_provider(self) -> GeminiVisionProvider:
        """Get Gemini Vision provider instance."""
        return GeminiVisionProvider(settings=self.settings.gemini)

    async def process(self, input: VisionLLMInput) -> VisionLLMOutput:
        """Process Vision LLM input using specified provider."""

        provider_name = input.provider_name

        try:
            if provider_name == 'openai-vision':
                provider = self.openai_vision_provider
            elif provider_name == 'gemini-vision':
                provider = self.gemini_vision_provider
            else:
                raise ValueError(
                    f"Unsupported vision provider: {provider_name}",
                )

            logger.info(f"Using vision provider: {provider.provider_type}")

            if input.vision_input is None:
                vision_input = LLMVisionInput(image_url='', prompt='')
            else:
                vision_input = input.vision_input

            vision_output = await provider.process(vision_input)

            return VisionLLMOutput(vision_output=vision_output)

        except Exception as e:
            logger.error(f"Vision provider failed: {e}")

            # Fallback description
            fallback_description = 'Image content'
            if input.vision_input and input.vision_input.context:
                fallback_description = input.vision_input.context.get(
                    'image_alt_text', 'Image content',
                )

            fallback_output = LLMVisionOutput(
                description=fallback_description,
            )

            return VisionLLMOutput(vision_output=fallback_output)
