from __future__ import annotations

from abc import abstractmethod
from enum import Enum
from typing import Any
from typing import Optional
from typing import Type

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from langchain.prompts import ChatPromptTemplate
from langchain.prompts import MessagesPlaceholder
from langchain_core.runnables.base import RunnableSequence

logger = get_logger(__name__)


class LLMProviderType(str, Enum):
    """Enumeration of supported LLM providers."""
    OPENAI = 'openai'
    CLAUDE = 'claude'
    GEMINI = 'gemini'
    FOXAILLM = 'foxaillm'


class BaseLLMInput(BaseModel):
    """Input model for LLM providers."""
    router: Optional[Type[BaseModel]] = None
    chat_history: Optional[list] = None

    class Config:
        arbitrary_types_allowed = True


class BaseLLMOutput(BaseModel):
    """Output model for LLM providers."""
    chain: RunnableSequence

    class Config:
        arbitrary_types_allowed = True


class BaseLLMProvider(BaseService):
    """Abstract base class for all LLM providers."""

    @property
    @abstractmethod
    def provider_type(self) -> LLMProviderType:
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

    def process(self, input_data: BaseLLMInput) -> BaseLLMOutput:
        """Process the input to create a chain based on BaseService pattern."""

        # Create messages
        messages = [
            ('system', '{system_prompt}'),
        ]

        # Add chat history if provided
        if input_data.chat_history is not None:
            messages.append(MessagesPlaceholder(variable_name='chat_history'))

        messages.append(('human', '{query}'))

        # Create prompt
        prompt = ChatPromptTemplate.from_messages(messages)

        # Get LLM instance
        llm_instance = self.client

        # Create chain
        if input_data.router is not None:
            chain = prompt | llm_instance.with_structured_output(
                input_data.router,
            )
        else:
            chain = prompt | llm_instance

        logger.info(f"Created {self.provider_type} chain successfully!")

        return BaseLLMOutput(
            chain=chain,
        )
