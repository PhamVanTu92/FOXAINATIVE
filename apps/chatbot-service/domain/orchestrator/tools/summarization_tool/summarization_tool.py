"""Conversation summarization tool for managing context window."""
from __future__ import annotations

from typing import List

from infrastructure.llm import LLMInput
from infrastructure.llm import LLMService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from joint.utils import tiktoken_counter
from langchain_core.messages import AIMessage
from langchain_core.messages import BaseMessage
from langchain_core.messages import HumanMessage
from langchain_core.messages import SystemMessage
from langchain_core.messages import ToolMessage

from .prompts import SYSTEM_PROMPT

logger = get_logger(__name__)


class SummarizationInput(BaseModel):
    """
    Input model for the SummarizationService, containing messages to summarize.
    """
    messages: List[BaseMessage]
    max_summary_tokens: int = 2000


class SummarizationOutput(BaseModel):
    """
    Output model for the SummarizationService, containing the summarized conversation.
    """
    summary: str
    original_tokens: int
    summary_tokens: int


class SummarizationService(BaseService):
    """
    Service responsible for summarizing conversations to manage context window limits.
    Uses the provider_llm specified to maintain consistency with the main chatbot.
    """
    settings: Settings
    # LLM provider to use for summarization (passed from parent service)
    provider_llm: str

    @property
    def llm_service(self) -> LLMService:
        """
        Returns the LLM service instance for summarization.

        Returns:
            LLMService: An instance of the LLM service.
        """
        return LLMService(settings=self.settings)

    def format_conversation_history(self, messages: List[BaseMessage]) -> str:
        """
        Format messages into readable conversation history.

        Args:
            messages: List of conversation messages

        Returns:
            Formatted conversation string
        """
        conversation_parts = []

        for msg in messages:
            if isinstance(msg, SystemMessage):
                # Skip system messages in summary as they're prompts
                continue
            elif isinstance(msg, HumanMessage):
                conversation_parts.append(f"User: {msg.content}")
            elif isinstance(msg, AIMessage):
                # Handle AI messages with or without tool calls
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    tool_names = [
                        tc.get('name', 'unknown')
                        for tc in msg.tool_calls
                    ]
                    conversation_parts.append(
                        f"Assistant: [Called tools: {', '.join(tool_names)}]",
                    )
                if msg.content:
                    conversation_parts.append(f"Assistant: {msg.content}")
            elif isinstance(msg, ToolMessage):
                # Summarize tool results without full content
                tool_name = getattr(msg, 'name', 'unknown_tool')
                content_preview = str(msg.content)[
                    :200
                ] + '...' if len(str(msg.content)) > 200 else str(msg.content)
                conversation_parts.append(
                    f"[Tool {tool_name} returned: {content_preview}]",
                )

        return '\n\n'.join(conversation_parts)

    def smart_truncate(self, content: str, max_chars: int) -> str:
        """
        Intelligently truncate content while preserving sentence structure.

        Args:
            content: Content to truncate
            max_chars: Maximum number of characters

        Returns:
            Truncated content
        """
        if len(content) <= max_chars:
            return content

        truncated = content[:max_chars]

        # Try to cut at paragraph boundary
        paragraph_end = truncated.rfind('\n\n')
        if paragraph_end > max_chars * 0.7:
            return content[:paragraph_end] + '\n\n[...content truncated due to length...]'

        # Try to cut at sentence boundary
        sentence_end = truncated.rfind('. ')
        if sentence_end > max_chars * 0.8:
            return content[:sentence_end + 1] + ' [...]'

        # Cut at word boundary
        word_end = truncated.rfind(' ')
        if word_end > 0:
            return content[:word_end] + '...'

        return truncated + '...'

    async def process(self, input: SummarizationInput) -> SummarizationOutput:
        """
        Summarize a conversation to compress context while retaining key information.

        Uses LLMService with the specified provider_llm to ensure consistency.
        The client is invoked directly (not through streaming) to avoid conflicts.

        Args:
            input: SummarizationInput containing messages and configuration

        Returns:
            SummarizationOutput containing summary and token counts
        """
        logger.info('---ROUTE SUMMARIZATION---')
        logger.info(
            f'Starting conversation summarization with provider: {self.provider_llm}',
        )

        try:
            # Format conversation history
            conversation_text = self.format_conversation_history(
                input.messages,
            )

            # Count tokens in conversation
            conversation_tokens = tiktoken_counter(
                [HumanMessage(content=conversation_text)],
            )
            logger.info(
                f'Conversation to summarize: {conversation_tokens} tokens',
            )

            # Prepare system prompt with token limit
            system_prompt = SYSTEM_PROMPT.format(
                max_summary_tokens=input.max_summary_tokens,
            )

            # Prepare user prompt with conversation
            user_prompt = f"""Below is the conversation that needs to be summarized:

{conversation_text}

Please provide a comprehensive summary following the specified format and staying within the {input.max_summary_tokens} token limit."""

            # Prepare summarization messages
            summarization_messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            # Use LLMService with specified provider for summarization
            logger.info(
                f"Using LLM provider '{self.provider_llm}' for summarization",
            )

            llm_input = LLMInput(provider_name=self.provider_llm)
            llm_client = self.llm_service.client(input=llm_input)

            # Invoke client for summarization (non-streaming to avoid graph conflicts)
            response = await llm_client.ainvoke(summarization_messages)
            summary = response.content

            # Verify summary is within token limit
            summary_tokens = tiktoken_counter([HumanMessage(content=summary)])
            logger.info(
                f'Summary generated: {summary_tokens} tokens (target: {input.max_summary_tokens})',
            )

            if summary_tokens > input.max_summary_tokens:
                logger.warning(
                    f'Summary exceeds target ({summary_tokens} > {input.max_summary_tokens}), truncating...',
                )
                # Truncate if needed
                words = summary.split()
                target_words = int(
                    len(words) * (input.max_summary_tokens / summary_tokens),
                )
                summary = ' '.join(words[:target_words]) + \
                    '\n\n[...summary has been shortened...]'
                summary_tokens = tiktoken_counter(
                    [HumanMessage(content=summary)],
                )

            logger.info('Summarization completed successfully!')
            return SummarizationOutput(
                summary=summary,
                original_tokens=conversation_tokens,
                summary_tokens=summary_tokens,
            )

        except Exception as e:
            logger.error(f'Error during summarization: {str(e)}')
            # Fallback: Simple truncation if summarization fails
            conversation_text = self.format_conversation_history(
                input.messages,
            )
            fallback_summary = f"[Automatic Summary]\n{conversation_text[:3000]}...\n[Conversation continues...]"

            return SummarizationOutput(
                summary=fallback_summary,
                original_tokens=tiktoken_counter(input.messages),
                summary_tokens=tiktoken_counter(
                    [HumanMessage(content=fallback_summary)],
                ),
            )
