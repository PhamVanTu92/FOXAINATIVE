from __future__ import annotations

from abc import abstractmethod
from enum import Enum
from typing import Any
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService


class LLMVisionProviderType(str, Enum):
    """Enumeration of supported Vision LLM providers."""
    OPENAI_VISION = 'openai-vision'
    CLAUDE_VISION = 'claude-vision'
    GEMINI_VISION = 'gemini-vision'


class LLMVisionInput(BaseModel):
    """Input model for Vision LLM providers."""
    prompt: str
    image_url: Optional[str] = ''
    file_path: Optional[str] = ''
    context: Optional[dict] = {}
    max_tokens: Optional[int] = 4096
    temperature: Optional[float] = 0.1
    structured_output: Optional[Any] = None


class LLMVisionOutput(BaseModel):
    """Output model for Vision LLM providers."""
    description: str
    structured_data: Optional[Any] = None


class BaseLLMVisionProvider(BaseService):
    """Abstract base class for all Vision LLM providers."""

    @property
    @abstractmethod
    def provider_type(self) -> LLMVisionProviderType:
        """Return the provider type."""
        pass

    @property
    @abstractmethod
    def client(self) -> Any:
        """Return the LLM instance."""
        pass

    @staticmethod
    @abstractmethod
    def reset_client() -> None:
        """Reset singleton client for cleanup."""
        pass

    @abstractmethod
    async def process(self, input: LLMVisionInput) -> LLMVisionOutput:
        """Analyze image and return description."""
        pass
