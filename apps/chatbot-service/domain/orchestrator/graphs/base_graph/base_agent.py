from __future__ import annotations

from typing import Any
from typing import Dict
from typing import List
from typing import Union

from infrastructure.llm import LLMInput
from infrastructure.llm import LLMService
from joint.base import BaseModel
from joint.logging import get_logger
from joint.settings import Settings
from joint.utils import get_vietnam_time
from joint.utils import measure_time
from joint.utils import process_tool_messages
from joint.utils import tiktoken_counter
from joint.utils import trim_messages_for_llm
from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.messages import BaseMessage
from langchain_core.messages import SystemMessage
from langchain_core.messages import ToolMessage
from langgraph.graph import MessagesState

logger = get_logger(__name__)


class BaseAgent(BaseModel):
    settings: Settings
    provider_llm: str

    @property
    def max_context_window(self) -> int:
        """Get max context window from settings based on provider."""
        if self.provider_llm == 'openai':
            return self.settings.openai.max_context_window
        elif self.provider_llm == 'gemini':
            return self.settings.gemini.max_context_window
        elif self.provider_llm == 'claude':
            return self.settings.claude.max_context_window
        elif self.provider_llm == 'foxaillm':
            return self.settings.foxaillm.max_context_window
        else:
            return 1000000  # Default fallback

    @property
    def max_output_tokens(self) -> int:
        """Get max output tokens from settings based on provider."""
        if self.provider_llm == 'openai':
            return self.settings.openai.max_output_tokens
        elif self.provider_llm == 'gemini':
            return self.settings.gemini.max_output_tokens
        elif self.provider_llm == 'claude':
            return self.settings.claude.max_output_tokens
        elif self.provider_llm == 'foxaillm':
            return self.settings.foxaillm.max_output_tokens
        else:
            return 4096  # Default fallback

    @property
    def max_tool_message_tokens(self) -> int:
        """
        Calculate safe max tokens for a SINGLE ToolMessage.
        Should be much smaller than context window to leave room for:
        - System prompt
        - Conversation history
        - Output tokens
        """
        # Use 25% of available input tokens for a single tool message
        safety_buffer = 1000
        available_input = self.max_context_window - \
            self.max_output_tokens - safety_buffer
        return int(available_input * 0.3)  # 30% for one tool message

    @property
    def llm_service(self) -> LLMService:
        """Initializes and returns an LLM service instance."""
        return LLMService(settings=self.settings)

    @property
    def get_default_context(self) -> Dict[str, Any]:
        """Get default context variables for system prompt formatting."""
        return {
            'time': get_vietnam_time(),
        }

    def _extract_plain_text_content(self, content: Any) -> str:
        """Extract plain text from mixed message content blocks."""
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            texts: List[str] = []
            for part in content:
                if isinstance(part, str):
                    if part.strip():
                        texts.append(part)
                    continue

                if isinstance(part, dict):
                    part_type = str(part.get('type', '')).lower()
                    if part_type in {
                        'tool_call', 'tool_use', 'tool_result',
                        'function_call', 'function_response',
                    }:
                        continue

                    text_value = part.get('text')
                    if isinstance(text_value, str) and text_value.strip():
                        texts.append(text_value)
                        continue

                text_fallback = str(part).strip()
                if text_fallback:
                    texts.append(text_fallback)

            return '\n'.join(texts).strip()

        if isinstance(content, dict):
            text_value = content.get('text')
            if isinstance(text_value, str):
                return text_value
            return ''

        return str(content or '')

    def _has_function_protocol_blocks(self, msg: BaseMessage) -> bool:
        """Detect tool/function protocol payloads that Gemini may reject."""
        if isinstance(msg, AIMessage) and getattr(msg, 'tool_calls', None):
            return True

        additional_kwargs = getattr(msg, 'additional_kwargs', None) or {}
        if isinstance(additional_kwargs, dict):
            if additional_kwargs.get('function_call') or additional_kwargs.get('tool_calls'):
                return True

        content = getattr(msg, 'content', None)
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                if (
                    part.get('function_call') is not None
                    or part.get('function_response') is not None
                    or str(part.get('type', '')).lower() in {
                        'tool_call', 'tool_use', 'tool_result',
                        'function_call', 'function_response',
                    }
                ):
                    return True

        return False

    def _sanitize_messages_for_gemini(
        self,
        messages: List[BaseMessage],
    ) -> List[BaseMessage]:
        """Convert tool protocol messages to plain text for Gemini compatibility.

        Gemini preview/tool APIs can reject replayed function_call parts when
        historical messages do not carry provider-specific thought signatures.
        """
        if 'gemini' not in str(self.provider_llm).lower():
            return messages

        sanitized: List[BaseMessage] = []
        converted_tool_calls = 0
        converted_tool_responses = 0

        for msg in messages:
            plain_text = self._extract_plain_text_content(getattr(msg, 'content', ''))

            if isinstance(msg, AIMessage) and self._has_function_protocol_blocks(msg):
                converted_tool_calls += 1
                if plain_text:
                    sanitized.append(AIMessage(content=plain_text))
                continue

            if isinstance(msg, ToolMessage):
                converted_tool_responses += 1
                tool_name = msg.name or 'tool'
                if plain_text:
                    sanitized.append(
                        HumanMessage(
                            content=f"[Tool result from {tool_name}]\n{plain_text}",
                        ),
                    )
                continue

            if isinstance(msg, HumanMessage):
                if plain_text:
                    sanitized.append(HumanMessage(content=plain_text))
                continue

            if isinstance(msg, AIMessage):
                if plain_text:
                    sanitized.append(AIMessage(content=plain_text))
                continue

            sanitized.append(msg)

        if converted_tool_calls or converted_tool_responses:
            logger.info(
                'Gemini message sanitation applied: '
                f'tool_calls={converted_tool_calls}, '
                f'tool_responses={converted_tool_responses}',
            )

        return sanitized

    @measure_time  # Apply the decorator
    async def __call__(self, state: MessagesState, tools: list, system_prompt: str, **prompt_kwargs) -> Dict[str, Union[List[Any], int]]:
        logger.info('\n---CALL AGENT---')

        # STEP 0: Calculate token limits FIRST
        max_output_tokens = self.max_output_tokens
        safety_buffer = 1000
        max_input_tokens = self.max_context_window - max_output_tokens - safety_buffer
        max_tool_msg_tokens = self.max_tool_message_tokens

        logger.info(
            f"Token budget: context={self.max_context_window}, "
            f"max_input={max_input_tokens}, max_output={max_output_tokens}, "
            f"max_per_tool={max_tool_msg_tokens}",
        )

        llm_input = LLMInput(
            provider_name=self.provider_llm,
        )
        model = self.llm_service.client(input=llm_input).bind_tools(tools)

        # Prepare default context variables
        default_context = self.get_default_context

        # Merge with any additional context provided by caller
        context_variables = {**default_context, **prompt_kwargs}

        # Format system prompt
        system_prompt_content = system_prompt.format(**context_variables)

        # STEP 1: Process ToolMessages to prevent overflow from search results
        # Use DYNAMIC limit based on context window
        processed_messages = process_tool_messages(
            state['messages'],
            max_tool_message_tokens=max_tool_msg_tokens,
        )
        logger.info(
            f"Processed {len([m for m in processed_messages if isinstance(m, ToolMessage)])} ToolMessages",
        )

        # STEP 2: Combine system prompt with processed messages (for LLM input)
        messages = [
            SystemMessage(content=system_prompt_content),
        ] + processed_messages

        # Gemini compatibility: avoid replaying tool protocol history that can
        # fail with missing thought_signature.
        messages = self._sanitize_messages_for_gemini(messages)

        initial_tokens = tiktoken_counter(messages)
        logger.info(f"Initial tokens: {initial_tokens}")

        # STEP 3: Trim messages if they exceed safe input limit
        if initial_tokens > max_input_tokens:
            logger.warning(
                f"Messages exceed safe limit! ({initial_tokens} > {max_input_tokens})",
            )
            logger.warning(
                'This should have been handled by summarization. Trimming messages as emergency fallback...',
            )

            # Emergency trim: keep system message + recent messages
            trimmed_messages = trim_messages_for_llm(messages, max_tokens=15)

            # Double-check token count after trim
            prompt_token = tiktoken_counter(trimmed_messages)

            # If STILL too large, aggressively trim
            attempt = 1
            while prompt_token > max_input_tokens and len(trimmed_messages) > 2:
                logger.warning(
                    f"Trim attempt {attempt}: {prompt_token} tokens, removing more messages...",
                )
                trimmed_messages = trim_messages_for_llm(
                    messages, max_tokens=max(2, 15 - attempt * 3),
                )
                prompt_token = tiktoken_counter(trimmed_messages)
                attempt += 1

                if attempt > 5:
                    logger.error(
                        'Cannot trim messages enough! Breaking to avoid infinite loop.',
                    )
                    break

            logger.info(
                f"After emergency trim: {len(trimmed_messages)} messages, {prompt_token} tokens",
            )
        else:
            trimmed_messages = messages
            prompt_token = initial_tokens
            logger.info(
                f"Messages within safe limit ({prompt_token}/{max_input_tokens})",
            )

        logger.info(
            f"Final prompt: {len(trimmed_messages)} messages, {prompt_token} tokens ({prompt_token/max_input_tokens*100:.1f}% of safe input)",
        )

        # STEP 4: Invoke LLM
        response = await model.ainvoke(trimmed_messages)

        completion_token = tiktoken_counter([response])
        logger.info(f"Completion tokens: {completion_token}")

        # STEP 5: Return result
        return {
            'messages': [response],
            'prompt_token': prompt_token,
            'completion_token': completion_token,
        }
