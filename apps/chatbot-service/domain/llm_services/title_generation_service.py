from __future__ import annotations

from typing import Optional

from infrastructure.llm import LLMInput
from infrastructure.llm import LLMService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_LLM_PROVIDER
from joint.settings.settings import Settings
from langchain_core.messages import HumanMessage
from langchain_core.messages import SystemMessage

from .prompts import TITLE_GENERATION_SYSTEM_PROMPT
from .prompts import TITLE_GENERATION_USER_PROMPT_TEMPLATE

logger = get_logger(__name__)


class TitleGenerationInput(BaseModel):
    """
    Input model for title generation service.
    Contains the first message to generate title from.
    """
    first_message: str
    provider_llm: str = DEFAULT_LLM_PROVIDER


class TitleGenerationOutput(BaseModel):
    """
    Output model for title generation service.
    Contains status, generated title and any error message.
    """
    status: bool
    title: Optional[str] = None
    message: str = ''


class TitleGenerationService(BaseService):
    """
    Service to generate conversation titles from first user message using LLM.

    Uses OpenAI (or other LLM providers) to generate a short, descriptive title
    based on the first message in a conversation.
    """

    settings: Settings

    @property
    def llm_service(self) -> LLMService:
        """Get LLM service instance."""
        return LLMService(settings=self.settings)

    def process(self, input: TitleGenerationInput) -> TitleGenerationOutput:
        """
        Generate a conversation title from the first message.

        Args:
            input: TitleGenerationInput containing the first message

        Returns:
            TitleGenerationOutput with status, title and message
        """
        try:
            # Validate input
            if not input.first_message or not input.first_message.strip():
                logger.warning('Empty message provided for title generation')
                return TitleGenerationOutput(
                    status=False,
                    message='Cannot generate title from empty message',
                )

            # Truncate very long messages for title generation (max 300 chars for better quality)
            first_message = input.first_message.strip()
            if len(first_message) > 300:
                first_message = first_message[:300] + '...'
                logger.info(
                    'Truncated long message to 300 chars for title generation',
                )

            # Create messages using professional prompts
            user_prompt = TITLE_GENERATION_USER_PROMPT_TEMPLATE.format(
                message=first_message,
            )

            logger.info(
                f"Generating title for message: {first_message[:100]}...",
            )

            llm_input = LLMInput(provider_name=input.provider_llm)
            model = self.llm_service.client(input=llm_input)

            # Invoke model with system + user messages for better quality
            messages = [
                SystemMessage(content=TITLE_GENERATION_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
            response = model.invoke(messages)

            if not response or not response.content:
                logger.error(
                    'LLM returned empty response for title generation',
                )
                return TitleGenerationOutput(
                    status=False,
                    message='LLM returned empty response',
                )

            # Extract and clean the title
            generated_title = response.content.strip()

            # Remove common prefixes that LLM might add
            prefixes_to_remove = [
                'Title:', 'title:', 'TITLE:',
                'Tiêu đề:', 'tiêu đề:', 'TIÊU ĐỀ:',
            ]
            for prefix in prefixes_to_remove:
                if generated_title.startswith(prefix):
                    generated_title = generated_title[len(prefix):].strip()

            # Remove quotes if present
            if generated_title.startswith('"') and generated_title.endswith('"'):
                generated_title = generated_title[1:-1]
            if generated_title.startswith("'") and generated_title.endswith("'"):
                generated_title = generated_title[1:-1]

            # Ensure max 50 characters (Vietnamese-aware truncation)
            if len(generated_title) > 50:
                generated_title = generated_title[:47] + '...'
                logger.info(f"Truncated title to 50 chars: {generated_title}")

            # Fallback if title is too short or empty after cleaning
            if len(generated_title) < 3:
                # Use first few words from message as fallback
                words = first_message.split()[:5]
                generated_title = ' '.join(words)
                if len(generated_title) > 50:
                    generated_title = generated_title[:47] + '...'
                if len(generated_title) < 3:
                    generated_title = 'Cuộc trò chuyện mới'
                logger.warning(
                    f"Generated title too short, using fallback: {generated_title}",
                )

            logger.info(f"Successfully generated title: {generated_title}")

            return TitleGenerationOutput(
                status=True,
                title=generated_title,
                message='Title generated successfully',
            )

        except Exception as e:
            logger.error(f"Error generating title: {str(e)}", exc_info=True)
            return TitleGenerationOutput(
                status=False,
                message=f"Error generating title: {str(e)}",
            )
