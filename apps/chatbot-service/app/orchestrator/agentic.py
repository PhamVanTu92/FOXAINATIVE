from __future__ import annotations

import asyncio
import time
import uuid
from functools import cached_property
from typing import Any
from typing import AsyncGenerator
from typing import Callable
from typing import Dict
from typing import List
from typing import Optional
from typing import Union
from uuid import uuid4

from domain.db_service.conversation_services import CreatingConversationInput
from domain.db_service.conversation_services import CreatingConversationService
from domain.db_service.conversation_services import GettingConversationByIdInput
from domain.db_service.conversation_services import GettingConversationByIdService
from domain.db_service.conversation_services import UpdatingConversationInput
from domain.db_service.conversation_services import UpdatingConversationService
from domain.db_service.file_attachment_services import GettingFileAttachmentsByIdsInput
from domain.db_service.file_attachment_services import GettingFileAttachmentsByIdsService
from domain.db_service.file_attachment_services import UpdatingFileAttachmentMessageInput
from domain.db_service.file_attachment_services import UpdatingFileAttachmentMessageService
from domain.db_service.message_services import CreatingMessageInput
from domain.db_service.message_services import CreatingMessageService
from domain.db_service.message_services import GettingAllMessagesByConversationInput
from domain.db_service.message_services import GettingAllMessagesByConversationService
from domain.llm_services import TitleGenerationInput
from domain.llm_services import TitleGenerationService
from domain.orchestrator.graphs.agentic_graph.graph import AgenticService
from domain.orchestrator.tools.summarization_tool import SummarizationInput
from domain.orchestrator.tools.summarization_tool import SummarizationService
from infrastructure.memory import CheckpointerFactory
from infrastructure.memory import Mem0MemoryService
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_COLLECTION
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_LLM_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.settings.settings import Settings
from joint.utils import convert_db_messages_to_langchain
from joint.utils import create_summary_message
from joint.utils import create_background_task
from joint.utils import extract_user_query_from_context
from joint.utils import prepare_messages_for_removal
from joint.utils import run_db_operation
from joint.utils import should_summarize_conversation
from joint.utils import tiktoken_counter
from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.messages import SystemMessage
from langchain_core.messages import ToolMessage
from langdetect import detect
from langfuse.langchain import CallbackHandler as LangfuseCallbackHandler
from langdetect.lang_detect_exception import LangDetectException
from pydantic import BaseModel
from pydantic import Field
from pydantic import model_validator
from sse_starlette.sse import ServerSentEvent

logger = get_logger(__name__)


def _mem0_scope_id(
    user_id: uuid.UUID | None,
    chatbot_id: uuid.UUID | None,
) -> str:
    """Namespace Mem0 memories by (user, chatbot).

    Mem0 keys memories by a single ``user_id`` string. If we only passed the
    real user_id, memories from chatting with bot A would leak into bot B for
    the same person (cross-chatbot topic suggestions, scope drift). Joining
    with the chatbot_id keeps each pair isolated. Legacy non-chatbot chats
    fall back to the raw user_id namespace.
    """
    base = str(user_id) if user_id is not None else 'anon'
    if chatbot_id is None:
        return base
    return f'{base}::bot::{chatbot_id}'


class ErrorSSEData(BaseModel):
    error: str
    details: str | None


class Artifact(BaseModel):
    """Artifact data structure for tool outputs"""
    form: Optional[Dict[str, Any]] = Field(
        None, description='Tool call arguments/form data',
    )
    data: Optional[str] = Field(None, description='Tool output data (content)')
    sources: Optional[List[Any]] = Field(
        None, description='Source metadata/artifacts from retriever',
    )


class StreamAgentRequestBody(BaseModel):
    """Request body model for API endpoint - without user_id"""
    message: str = Field(..., description='Message sent from user.')
    conversation_id: Optional[uuid.UUID] = Field(
        None,
        description='Optional conversation ID. If not provided, a new conversation will be created automatically.',
    )
    file_ids: Optional[List[uuid.UUID]] = Field(
        None,
        description='Optional list of file attachment IDs from /files/upload. Content will be injected as context.',
    )
    provider_llm: str = DEFAULT_LLM_PROVIDER
    provider_storage: str = DEFAULT_STORAGE_PROVIDER
    provider_embedding: str = DEFAULT_EMBEDDING_PROVIDER
    collection_name: str = DEFAULT_COLLECTION
    # foxai-native: when set, server loads the chatbot and overrides
    # collections / providers / prompt with the stored configuration.
    chatbot_id: Optional[uuid.UUID] = Field(
        None,
        description='Optional chatbot ID — when present, server overrides collections/providers/prompt with stored chatbot config.',
    )


class StreamAgentInput(BaseModel):
    """Internal model for passing data to StreamAgentService.

    ``user_id`` may be None for anonymous embed sessions (the chatbot's
    own configuration is what drives behavior, not user identity).
    """
    user_id: Optional[uuid.UUID] = None
    message: str = Field(..., description='Message sent from user.')
    conversation_id: Optional[uuid.UUID] = Field(
        None,
        description='Optional conversation ID. If not provided, a new conversation will be created automatically.',
    )
    file_ids: Optional[List[uuid.UUID]] = Field(
        None,
        description='Optional list of file attachment IDs. Content will be injected as context.',
    )
    provider_llm: str = DEFAULT_LLM_PROVIDER
    provider_storage: str = DEFAULT_STORAGE_PROVIDER
    provider_embedding: str = DEFAULT_EMBEDDING_PROVIDER
    # Single name kept for backwards compat; ``collection_names`` is preferred.
    collection_name: str = DEFAULT_COLLECTION
    collection_names: Optional[List[str]] = None
    # Bound chatbot — when present, the conversation is tagged with it.
    chatbot_id: Optional[uuid.UUID] = None
    # Per-chatbot prompt augmentations.
    chatbot_instructions: Optional[str] = None
    faq_block: Optional[str] = None


class StreamAgentOutput(BaseModel):
    name: str
    type: Any  # Use the MessageType enum here # TODO: old have type: MessageType
    id: str
    content: Optional[str] = ''
    language: Optional[str] = ''
    finishReason: Optional[str] = None
    artifact: Optional[Artifact] = Field(
        None, description='Artifact data from tool executions',
    )
    conversation_id: Optional[str] = Field(
        None, description='Conversation ID for client tracking',
    )


class StreamAgentService(BaseService):

    settings: Settings
    provider_llm: str
    provider_storage: str
    provider_embedding: str
    # ``collection_names`` is authoritative; ``collection_name`` is kept for
    # langfuse tagging / log messages and equals collection_names[0].
    collection_names: List[str] = Field(default_factory=list)
    collection_name: str = DEFAULT_COLLECTION
    # Per-chatbot prompt augmentations injected into the agentic_agent prompt.
    chatbot_instructions: str = ''
    faq_block: str = ''

    @model_validator(mode='after')
    def _ensure_collection_names(self) -> 'StreamAgentService':
        """Back-compat: callers that only pass ``collection_name`` get a list."""
        if not self.collection_names and self.collection_name:
            self.collection_names = [self.collection_name]
        return self

    @property
    def creating_message_service(self) -> CreatingMessageService:
        """Initializes and returns a CreatingMessageService instance."""
        return CreatingMessageService(settings=self.settings.postgres)

    @property
    def creating_conversation_service(self) -> CreatingConversationService:
        """Initializes and returns a CreatingConversationService instance."""
        return CreatingConversationService(settings=self.settings.postgres)

    @property
    def getting_conversation_service(self) -> GettingConversationByIdService:
        """Initializes and returns a GettingConversationByIdService instance."""
        return GettingConversationByIdService(settings=self.settings.postgres)

    @cached_property
    def agentic_service(self) -> AgenticService:
        """Initialize and return the AgenticService instance (cached)."""
        return AgenticService(
            settings=self.settings,
            provider_llm=self.provider_llm,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
            collection_names=self.collection_names,
            chatbot_instructions=self.chatbot_instructions,
            faq_block=self.faq_block,
        )

    @property
    def summarization_service(self) -> SummarizationService:
        """Initializes and returns a Summarization service instance."""
        return SummarizationService(settings=self.settings, provider_llm=self.provider_llm)

    @property
    def getting_all_messages_service(self) -> GettingAllMessagesByConversationService:
        """Initializes and returns a service to load all messages for a conversation."""
        return GettingAllMessagesByConversationService(settings=self.settings.postgres)

    @property
    def mem0_service(self) -> Mem0MemoryService:
        """Initializes and returns a Mem0 memory service for personalization."""
        return Mem0MemoryService(settings=self.settings)

    @property
    def getting_file_attachments_service(self) -> GettingFileAttachmentsByIdsService:
        """Initializes and returns file attachments retrieval service."""
        return GettingFileAttachmentsByIdsService(settings=self.settings.postgres)

    @property
    def updating_file_attachment_message_service(self) -> UpdatingFileAttachmentMessageService:
        """Initializes and returns file attachment message update service."""
        return UpdatingFileAttachmentMessageService(settings=self.settings.postgres)

    def _get_provider_limits(self) -> tuple[int, int]:
        """Get max context window and max output tokens for the current LLM provider.

        Returns:
            Tuple of (max_context_window, max_output_tokens).
        """
        provider_map = {
            'openai': (self.settings.openai.max_context_window, self.settings.openai.max_output_tokens),
            'gemini': (self.settings.gemini.max_context_window, self.settings.gemini.max_output_tokens),
            'claude': (self.settings.claude.max_context_window, self.settings.claude.max_output_tokens),
            'foxaillm': (self.settings.foxaillm.max_context_window, self.settings.foxaillm.max_output_tokens),
        }
        return provider_map.get(self.provider_llm, (128000, 2048))

    async def _restore_state_from_postgres(
        self,
        graph,
        config: dict,
        conversation_id: uuid.UUID,
        db_session_factory: Callable | None = None,
    ) -> None:
        """Restore LangGraph state from PostgreSQL when Redis cache has expired.

        Loads all messages for the conversation, checks token count against
        the provider's context window, and applies summarization if needed
        before injecting into the graph state.

        Args:
            graph: Compiled LangGraph instance.
            config: Graph config dict with thread_id.
            conversation_id: UUID of the conversation to restore.
            db_session_factory: Session factory for short-lived DB access.
        """
        logger.info(
            f"Restoring state from PostgreSQL for conversation {conversation_id}",
        )

        # Load all messages from PostgreSQL (offload sync I/O to threadpool)
        load_input = GettingAllMessagesByConversationInput(
            conversation_id=conversation_id,
        )
        load_result = await run_db_operation(
            db_session_factory,
            self.getting_all_messages_service.process,
            load_input,
        )

        if not load_result.status or not load_result.data:
            logger.warning(
                f"No messages found in PostgreSQL for conversation {conversation_id} - starting fresh",
            )
            return

        # Convert DB messages to LangChain format
        restored_messages = convert_db_messages_to_langchain(load_result.data)
        if not restored_messages:
            logger.warning(
                'Converted message list is empty - skipping restoration',
            )
            return

        # Token-aware check: summarize if exceeds threshold
        total_tokens = tiktoken_counter(restored_messages)
        max_context_window, max_output_tokens = self._get_provider_limits()

        if should_summarize_conversation(
            messages=restored_messages,
            total_tokens=total_tokens,
            max_context_window=max_context_window,
            max_output_tokens=max_output_tokens,
            summarization_threshold=0.5,
            safety_buffer=1000,
        ):
            logger.info(
                f"Restored messages exceed threshold ({total_tokens} tokens) - summarizing",
            )
            summarization_input = SummarizationInput(
                messages=restored_messages,
                max_summary_tokens=3000,
            )
            summarization_output = await self.summarization_service.process(summarization_input)
            summary_msg = create_summary_message(summarization_output.summary)

            # Keep N most recent message pairs (human+ai)
            keep_count = self.settings.redis.restore_keep_pairs * 2
            recent_messages = restored_messages[-keep_count:] if len(
                restored_messages,
            ) > keep_count else restored_messages
            final_messages = [summary_msg] + recent_messages

            logger.info(
                f"State restoration: summary ({summarization_output.summary_tokens} tokens) "
                f"+ {len(recent_messages)} recent messages",
            )
        else:
            final_messages = restored_messages
            logger.info(
                f"State restoration: {len(final_messages)} messages ({total_tokens} tokens) - no summarization needed",
            )

        # Inject restored messages into graph state
        await graph.aupdate_state(config, {'messages': final_messages})
        logger.info(
            f"Successfully restored state for conversation {conversation_id}",
        )

    async def process(
        self,
        input: StreamAgentInput,
        db_session_factory: Callable | None = None,
    ) -> AsyncGenerator[ServerSentEvent, None]:
        """Stream messages from the agentic service.

        Uses short-lived DB sessions via *db_session_factory* so that
        connections are returned to the pool immediately after each
        operation instead of being held for the entire SSE stream.

        Args:
            input: StreamAgentInput containing user message and metadata.
            db_session_factory: Callable returning a context-manager session.
        """
        logger.info(
            f"Starting Agent message stream for user_id: {input.user_id}, message: '{input.message}'",
            extra={
                'user_id': str(input.user_id),
                'conversation_id': str(input.conversation_id) if input.conversation_id else 'None (will create new)',
            },
        )

        # Handle conversation: create new if conversation_id is None or check if exists
        conversation_id = input.conversation_id
        is_new_conversation = False

        if conversation_id is None:
            logger.info(
                'No conversation_id provided - creating new conversation',
            )
            try:
                # Create new conversation with temporary title
                conversation_input = CreatingConversationInput(
                    user_id=input.user_id,
                    chatbot_id=input.chatbot_id,
                    title='New Conversation',  # Temporary title, will be updated by background task
                )
                conversation_result = await run_db_operation(
                    db_session_factory,
                    self.creating_conversation_service.process,
                    conversation_input,
                )

                if conversation_result.status and conversation_result.conversation_id:
                    conversation_id = conversation_result.conversation_id
                    is_new_conversation = True
                    logger.info(
                        f"Successfully created new conversation: {conversation_id}",
                    )
                else:
                    error_msg = f"Failed to create conversation: {conversation_result.message}"
                    logger.error(error_msg)
                    # Yield error event and return
                    error_data = ErrorSSEData(
                        error='ConversationCreationError', details=error_msg,
                    )
                    yield ServerSentEvent(event='error', data=error_data.model_dump_json())
                    return
            except Exception as e:
                error_msg = f"Exception creating conversation: {str(e)}"
                logger.error(error_msg, exc_info=True)
                error_data = ErrorSSEData(
                    error='ConversationCreationError', details=error_msg,
                )
                yield ServerSentEvent(event='error', data=error_data.model_dump_json())
                return
        else:
            # Check if conversation exists and is accessible to user
            logger.info(f"Checking if conversation exists: {conversation_id}")
            try:
                check_input = GettingConversationByIdInput(
                    conversation_id=conversation_id,
                )
                check_result = await run_db_operation(
                    db_session_factory,
                    self.getting_conversation_service.process,
                    check_input,
                )

                if not check_result.status or not check_result.conversation:
                    logger.warning(
                        f"Conversation not found or inaccessible: {conversation_id} - creating new conversation",
                    )
                    # Create new conversation instead
                    conversation_input = CreatingConversationInput(
                        user_id=input.user_id,
                        chatbot_id=input.chatbot_id,
                        title='New Conversation',
                    )
                    conversation_result = await run_db_operation(
                        db_session_factory,
                        self.creating_conversation_service.process,
                        conversation_input,
                    )

                    if conversation_result.status and conversation_result.conversation_id:
                        conversation_id = conversation_result.conversation_id
                        is_new_conversation = True
                        logger.info(
                            f"Successfully created new conversation to replace missing one: {conversation_id}",
                        )
                    else:
                        error_msg = f"Failed to create replacement conversation: {conversation_result.message}"
                        logger.error(error_msg)
                        error_data = ErrorSSEData(
                            error='ConversationCreationError', details=error_msg,
                        )
                        yield ServerSentEvent(event='error', data=error_data.model_dump_json())
                        return
                else:
                    # Check if user owns this conversation
                    if check_result.conversation.user_id != input.user_id:
                        logger.warning(
                            f"User {input.user_id} does not own conversation {conversation_id} - creating new conversation",
                        )
                        conv_result = await run_db_operation(
                            db_session_factory,
                            self.creating_conversation_service.process,
                            CreatingConversationInput(
                                user_id=input.user_id,
                                chatbot_id=input.chatbot_id,
                                title='New Conversation',
                            ),
                        )
                        if conv_result.status and conv_result.conversation_id:
                            conversation_id = conv_result.conversation_id
                            is_new_conversation = True
                            logger.info(f"Created new conversation for user: {conversation_id}")
                        else:
                            error_data = ErrorSSEData(error='ConversationCreationError', details=conv_result.message)
                            yield ServerSentEvent(event='error', data=error_data.model_dump_json())
                            return
                    else:
                        logger.info(f"Using existing conversation: {conversation_id}")
            except Exception as e:
                error_msg = f"Exception checking conversation: {str(e)}"
                logger.error(error_msg, exc_info=True)
                error_data = ErrorSSEData(
                    error='ConversationCheckError', details=error_msg,
                )
                yield ServerSentEvent(event='error', data=error_data.model_dump_json())
                return

        # Emit conversation_id to client immediately
        conv_start_payload = StreamAgentOutput(
            name='system',
            type='conversation_started',
            id=str(uuid4()),
            content='',
            conversation_id=str(conversation_id),
        )
        yield ServerSentEvent(data=conv_start_payload.model_dump_json())
        logger.info(f"Emitted conversation_id to client: {conversation_id}")

        # Build final message
        original_message = input.message

        # Inject file attachment content into message if file_ids provided
        file_ids_for_update: List[uuid.UUID] = []
        if input.file_ids:
            try:
                attachments_result = await run_db_operation(
                    db_session_factory,
                    self.getting_file_attachments_service.process,
                    GettingFileAttachmentsByIdsInput(file_ids=input.file_ids),
                )
                if attachments_result.status and attachments_result.attachments:
                    file_ids_for_update = [a.id for a in attachments_result.attachments]
                    total = len(attachments_result.attachments)
                    separator = '═' * 64

                    file_context_parts = []
                    for idx, att in enumerate(attachments_result.attachments, 1):
                        file_context_parts.append(
                            f'{separator}\n'
                            f'TÀI LIỆU {idx}/{total}: {att.file_name}\n'
                            f'{att.extracted_content}\n'
                            f'{separator}\n'
                            f'KẾT THÚC TÀI LIỆU {idx}\n'
                            f'{separator}',
                        )

                    count_label = 'một' if total == 1 else str(total)
                    doc_ref = 'tài liệu trên' if total == 1 else f'{total} tài liệu trên'
                    file_context = '\n'.join(file_context_parts)

                    original_message = (
                        f'Tôi đã tải lên {count_label} tài liệu với nội dung sau:\n'
                        f'{file_context}\n'
                        f'Dựa trên nội dung {doc_ref}, vui lòng giúp tôi: {input.message}'
                    )
                    logger.info(
                        f'Injected {total} file attachments into message '
                        f'(context length: {len(original_message)})',
                    )
                else:
                    logger.warning(
                        f'No attachments found for file_ids: {input.file_ids}',
                    )
            except Exception as e:
                logger.error(f'Error injecting file content: {e}', exc_info=True)

        # Detect language of the message with error handling
        history_lang = None
        if original_message:
            try:
                history_lang = detect(original_message)
            except LangDetectException as e:
                logger.warning(
                    f"Failed to detect language for message '{original_message}': {e}",
                )
                history_lang = 'en'  # Default to English if detection fails
            except Exception as e:
                logger.warning(
                    f"Unexpected error during language detection: {e}",
                )
                history_lang = 'en'  # Default to English if detection fails

        # Check if we need to handle a tool response
        message: Union[str, ToolMessage, HumanMessage] = original_message

        # Use conversation_id as thread_id to ensure each conversation has isolated memory
        config = {
            'configurable': {
                'thread_id': str(conversation_id),
            },
            'recursion_limit': 20,
            'callbacks': [LangfuseCallbackHandler()],
            'metadata': {
                'langfuse_user_id': str(input.user_id),
                'langfuse_session_id': str(conversation_id),
                'langfuse_tags': [self.provider_llm, *self.collection_names],
                'provider_llm': self.provider_llm,
                'collection_name': self.collection_names[0] if self.collection_names else self.collection_name,
            },
        }

        # Get checkpointer from factory (backend configurable via settings)
        checkpointer = await CheckpointerFactory.get_checkpointer(
            settings=self.settings,
            backend=self.settings.redis.checkpointer_backend,
        )

        graph = await self.agentic_service.process(
            checkpointer=checkpointer,
            user_id=str(input.user_id),
        )

        # Save graph visualization to file
        # import os
        # os.makedirs("graphs", exist_ok=True)
        # graph_image = graph.get_graph().draw_mermaid_png()
        # with open("graphs/agentic_graph.png", "wb") as f:
        #     f.write(graph_image)
        # logger.info("Graph visualization saved to graphs/agentic_graph.png")

        snapshot = await graph.aget_state(config, subgraphs=True)

        # Detect expired Redis state and restore from PostgreSQL if needed
        state_is_empty = (
            not snapshot.values
            or 'messages' not in snapshot.values
            or len(snapshot.values['messages']) == 0
        )
        if state_is_empty and not is_new_conversation and conversation_id is not None:
            logger.info(
                f"Redis state empty for conversation {conversation_id} - restoring from PostgreSQL",
            )
            await self._restore_state_from_postgres(
                graph=graph,
                config=config,
                conversation_id=conversation_id,
                db_session_factory=db_session_factory,
            )
            snapshot = await graph.aget_state(config, subgraphs=True)

        # Retrieve Mem0 personalization memories and inject into graph state.
        # Memory is namespaced by (user_id, chatbot_id) so a person who talks
        # to bot A first and bot B later does NOT see A's memories leaking
        # into B's context (this caused cross-chatbot topic suggestions —
        # e.g., a bot scoped to eKYC docs starting to mention LaoVietBank
        # products it never had access to).
        if self.settings.mem0.enabled:
            mem_scope = _mem0_scope_id(input.user_id, input.chatbot_id)
            memories = await self.mem0_service.retrieve_memories(
                query=original_message,
                user_id=mem_scope,
            )
            memory_context = Mem0MemoryService.format_memory_context(memories)
            if memory_context:
                await graph.aupdate_state(config, {'memory_context': memory_context})
                logger.info(
                    f"Injected {len(memories)} Mem0 memories into graph state",
                    extra={'user_id': str(input.user_id), 'mem_scope': mem_scope},
                )

        # Check if there are pending tool calls that need to be executed
        # This handles the case where graph is waiting for tool execution (snapshot.next is not empty)
        if snapshot and snapshot.next:
            logger.info(f"Graph has pending next steps: {snapshot.next}")

            # Check main state messages for pending tool calls
            last_message_with_toolcalls = None
            if snapshot.values and 'messages' in snapshot.values and snapshot.values['messages']:
                # Get the last message from main state
                for msg in reversed(snapshot.values['messages']):
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        last_message_with_toolcalls = msg
                        break

            # Also check subgraph tasks for pending tool calls
            if not last_message_with_toolcalls and snapshot.tasks:
                for task in snapshot.tasks:
                    if (
                        task.state is not None and
                        hasattr(task.state, 'values') and
                        'messages' in task.state.values and
                        task.state.values['messages']
                    ):
                        last_msg = task.state.values['messages'][-1]
                        if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                            last_message_with_toolcalls = last_msg
                            break

            if last_message_with_toolcalls:
                logger.info(
                    f"Found pending tool calls: {[tc['name'] for tc in last_message_with_toolcalls.tool_calls]}",
                )
                # User's input determines how to handle pending tool calls
                if original_message.strip().lower() == 'y':
                    # User approved - let graph continue with default execution (no new input)
                    message = None
                    logger.info(
                        'User approved tool calls - continuing execution',
                    )
                else:
                    # User provided feedback/rejection - create ToolMessage for ALL tool calls
                    tool_messages = []
                    for tool_call in last_message_with_toolcalls.tool_calls:
                        tool_messages.append(
                            ToolMessage(
                                tool_call_id=tool_call['id'],
                                content=f"API call denied by user. Reasoning: '{original_message}'. Continue assisting, accounting for the user's input.",
                            ),
                        )
                    message = tool_messages if len(
                        tool_messages,
                    ) > 1 else tool_messages[0]
                    logger.info(
                        f"User rejected tool calls - created {len(tool_messages)} ToolMessage(s)",
                    )
            else:
                # snapshot.next exists but no tool calls found - add new user message
                logger.info(
                    'No pending tool calls found - adding new user message',
                )
                message = HumanMessage(content=original_message)
        else:
            # No pending state - regular new conversation turn
            logger.info('No pending state - starting new conversation turn')
            message = ('user', original_message)

        # CHECK AND APPLY SUMMARIZATION BEFORE STREAMING
        # Get current state to check conversation length
        current_state = await graph.aget_state(config)
        if current_state.values and 'messages' in current_state.values:
            messages = current_state.values['messages']
            total_tokens = tiktoken_counter(messages)

            # Get max context window and max output tokens based on current provider
            max_context_window, max_output_tokens = self._get_provider_limits()

            summarization_threshold = 0.5  # 50% of available input space
            safety_buffer = 1000  # Safety buffer

            # Check if summarization needed
            if should_summarize_conversation(
                messages=messages,
                total_tokens=total_tokens,
                max_context_window=max_context_window,
                max_output_tokens=max_output_tokens,
                summarization_threshold=summarization_threshold,
                safety_buffer=safety_buffer,
            ):
                logger.info(
                    'Pre-streaming: Conversation too long, applying summarization...',
                )

                # Separate system messages from conversation
                conversation_messages = [
                    m for m in messages if not isinstance(m, SystemMessage)
                ]

                # Only summarize if we have enough conversation
                if len(conversation_messages) > 5:
                    # Summarize using isolated Gemini client
                    summarization_input = SummarizationInput(
                        messages=conversation_messages,
                        max_summary_tokens=3000,
                    )
                    summarization_output = await self.summarization_service.process(summarization_input)

                    # Create summary message
                    summary_message = create_summary_message(
                        summarization_output.summary,
                    )

                    # Prepare RemoveMessage objects for old messages
                    keep_count = 2
                    remove_messages = prepare_messages_for_removal(
                        messages=conversation_messages,
                        keep_count=keep_count,
                    )

                    logger.info(
                        f"Pre-streaming summarization: removing {len(remove_messages)} old messages, "
                        f"adding summary + keeping {keep_count} recent messages",
                    )

                    # Apply state update BEFORE streaming (async to avoid blocking)
                    await graph.aupdate_state(
                        config,
                        {'messages': remove_messages + [summary_message]},
                    )
                    logger.info(
                        'State updated with summarization - ready to stream',
                    )

        # Prepare input for graph
        if message is not None:
            if isinstance(message, tuple):
                # Convert tuple to proper message format
                graph_input = {'messages': [message]}
            elif isinstance(message, list):
                # Handle list of messages (e.g., multiple ToolMessages)
                graph_input = {'messages': message}
            elif isinstance(message, (HumanMessage, ToolMessage)):
                # Add additional message to existing state
                graph_input = {'messages': [message]}
            else:
                graph_input = {
                    'messages': [
                        HumanMessage(content=str(message)),
                    ],
                }
        else:
            # Continue with existing messages in initial_state
            graph_input = None

        full_response = ''
        stream_completed = False

        # Get existing message IDs to hilter out history
        current_state = await graph.aget_state(config)
        existing_message_ids = set()
        if current_state.values and 'messages' in current_state.values:
            for msg in current_state.values['messages']:
                if hasattr(msg, 'id') and msg.id:
                    existing_message_ids.add(msg.id)

        try:
            # Stream the response messages with timeout protection
            last_activity = time.time()
            KEEP_ALIVE_INTERVAL = 30  # Send keep-alive every 30 seconds

            async for node_name, (msg, metadata) in graph.astream(
                graph_input, config, stream_mode='messages', subgraphs=True,
            ):
                current_time = time.time()

                # Send keep-alive if no activity for too long
                if current_time - last_activity > KEEP_ALIVE_INTERVAL:
                    keepalive_payload = StreamAgentOutput(
                        content='',
                        name='system',
                        type='keep_alive',
                        id=str(uuid4()),
                        finishReason='',
                        conversation_id=str(conversation_id),
                    )
                    yield ServerSentEvent(data=keepalive_payload.model_dump_json())
                    last_activity = current_time

                if isinstance(msg, AIMessage) and msg.content:
                    msg_id = getattr(msg, 'id', None)

                    # Debug: log node name and message content preview
                    # logger.info(f"Stream message from node '{node_name}': {msg.content[:50]}...")

                    # Skip if this message already exists in history
                    if msg_id and msg_id in existing_message_ids:
                        logger.info(f"Skipping existing message ID: {msg_id}")
                        continue

                    # Filter out tool nodes but allow main agent nodes
                    # Only filter if node_name clearly indicates a tool
                    tool_keywords = [
                        'query_rewrite',
                        'rag_tool',
                        'retriever_tool',
                        'list_documents_tool',
                        'summarize_document_tool',
                        'search_tool',
                        'web_search',
                        'generate_and_execute_query_tool',
                    ]
                    if node_name and any(tool_name in str(node_name).lower() for tool_name in tool_keywords):
                        # logger.info(f"Filtering out tool output from node: {node_name}")
                        continue

                    # logger.info(f"Streaming content from node '{node_name}': {content_preview}...")
                    print(msg.content, end='|')

                    # Accumulate full response for saving to database
                    full_response += msg.content

                    # Send message chunk
                    payload = StreamAgentOutput(
                        content=msg.content,
                        name='agent',
                        type='message_chunk',
                        id=msg_id or str(uuid4()),
                        finishReason='',
                        conversation_id=str(conversation_id),
                    )
                    yield ServerSentEvent(data=payload.model_dump_json())

                    # Update last activity time
                    last_activity = current_time

            # Mark that streaming completed successfully
            stream_completed = True
            logger.info(
                f"AI processing complete for user {input.user_id} - stream_completed set to True",
            )
            logger.info(f"Full response length: {len(full_response)}")

            # Get final state for token usage
            final_state = await graph.aget_state(config, subgraphs=True)

            # Get token usage from state
            prompt_token = final_state.values.get(
                'prompt_token', 0,
            ) if final_state.values else 0
            completion_token = final_state.values.get(
                'completion_token', 0,
            ) if final_state.values else 0
            total_token = prompt_token + completion_token
            logger.info(
                f"Token usage - prompt: {prompt_token}, completion: {completion_token}, total: {total_token}",
            )

            # Extract artifact from state messages (similar to project1 pattern)
            artifact_data = None
            state_messages = []

            if final_state.next:
                # Graph has pending tasks - check subgraph
                if final_state.tasks:
                    state_messages = final_state.tasks[0].state.values.get(
                        'messages', [],
                    )
            else:
                # Graph completed - use main state
                state_messages = final_state.values.get('messages', [])

            # Reverse to get most recent messages first
            state_messages = list(reversed(state_messages))

            # Find last AI message with tool calls (skip existing messages)
            last_toolcall_message = None
            for msg in state_messages:
                if isinstance(msg, AIMessage) and hasattr(msg, 'tool_calls') and msg.tool_calls:
                    msg_id = getattr(msg, 'id', None)
                    # CRITICAL: Skip messages that existed BEFORE this stream started
                    if msg_id and msg_id in existing_message_ids:
                        logger.info(
                            f"Skipping existing toolcall message ID: {msg_id}",
                        )
                        continue
                    last_toolcall_message = msg
                    break

            # Find last ToolMessage corresponding to the tool call (skip existing messages)
            last_tool_message = None
            if last_toolcall_message:
                for msg in state_messages:
                    if (
                        isinstance(msg, ToolMessage) and
                        hasattr(msg, 'tool_call_id') and
                        msg.tool_call_id == last_toolcall_message.tool_calls[0]['id']
                    ):
                        msg_id = getattr(msg, 'id', None)
                        # CRITICAL: Skip messages that existed BEFORE this stream started
                        if msg_id and msg_id in existing_message_ids:
                            logger.info(
                                f"Skipping existing tool message ID: {msg_id}",
                            )
                            continue
                        last_tool_message = msg
                        break

            # Build artifact if we have NEW tool messages from current turn
            if last_toolcall_message or last_tool_message:
                artifact_data = Artifact()

                # Add form data (tool call arguments)
                if last_toolcall_message:
                    artifact_data.form = last_toolcall_message.tool_calls[0].get(
                        'args',
                    )

                # Add tool output data and sources
                if last_tool_message:
                    # For retriever tool, don't include content in data (it's already in LLM response)
                    # For other tools, include the content
                    if hasattr(last_tool_message, 'name') and last_tool_message.name != 'retriever_tool':
                        artifact_data.data = last_tool_message.content

                    # Extract artifact/sources if attached
                    if hasattr(last_tool_message, 'artifact'):
                        artifact_data.sources = last_tool_message.artifact
                        logger.info(
                            f"Extracted NEW artifact with {len(last_tool_message.artifact) if last_tool_message.artifact else 0} sources from tool: {last_tool_message.name}",
                        )

            # Send final completion message with artifact
            payload = StreamAgentOutput(
                name='agent',
                type='message_complete',
                id=str(input.user_id),
                finishReason='stop',
                content='',
                language=history_lang,
                artifact=artifact_data,  # Include artifact data
                conversation_id=str(conversation_id),
            )
            yield ServerSentEvent(data=payload.model_dump_json())

        except asyncio.CancelledError:
            # Client disconnected - this is normal, just log and cleanup gracefully
            logger.info(
                f"Client disconnected for user {input.user_id} - cleaning up gracefully",
                extra={
                    'user_id': str(input.user_id),
                    'conversation_id': str(conversation_id),
                    'stream_completed': stream_completed,
                },
            )

            # Important: Try to cancel any ongoing LangGraph operations
            try:
                # Cancel the current graph execution if possible
                if hasattr(graph, '_tasks'):
                    for task in graph._tasks:
                        if not task.done():
                            task.cancel()
                            logger.info(f"Cancelled graph task: {task}")
            except Exception as cancel_error:
                logger.warning(f"Failed to cancel graph tasks: {cancel_error}")

            raise  # Must re-raise to propagate cancellation for proper async cleanup

        except Exception as e:
            logger.error(
                f"Error in agent stream for user {input.user_id}: {e}", exc_info=True,
            )
            error_data = ErrorSSEData(
                error=type(e).__name__,
                details=f"Internal server error: {str(e)}",
            )
            yield ServerSentEvent(event='error', data=error_data.model_dump_json())

        finally:
            logger.info(
                f"Agent message stream ended for user_id: {input.user_id}",
                extra={
                    'user_id': str(input.user_id),
                    'conversation_id': str(conversation_id),
                    'stream_completed': stream_completed,
                    'is_new_conversation': is_new_conversation,
                },
            )

            # Note: With Redis checkpointer, memory cleanup is handled by TTL
            # No manual cleanup needed for cancelled streams

            # Save conversation history after streaming completes or if there was an error
            # Only save if streaming completed successfully and we have content
            logger.info(
                f"DEBUG: stream_completed={stream_completed}, full_response_length={len(full_response.strip()) if full_response else 0}",
            )
            if stream_completed and full_response.strip():
                try:
                    logger.info('Starting to save conversation history...')

                    # Clean user message - extract original query without file context
                    # Only user message needs cleaning because we injected file context into it
                    clean_user_message = extract_user_query_from_context(
                        original_message,
                    )

                    logger.info(
                        'Cleaned user message before saving',
                        extra={
                            'original_user_length': len(original_message),
                            'clean_user_length': len(clean_user_message),
                            'had_file_context': len(original_message) != len(clean_user_message),
                        },
                    )

                    creating_message_input = CreatingMessageInput(
                        user_message=clean_user_message,  # Save ONLY user's actual query
                        assistant_message=full_response,  # AI response is already clean
                        user_id=input.user_id,
                        conversation_id=conversation_id,  # Link messages to conversation
                        artifacts=artifact_data.model_dump() if artifact_data else None,  # Add artifacts data
                    )
                    result = await run_db_operation(
                        db_session_factory,
                        self.creating_message_service.process,
                        creating_message_input,
                    )
                    logger.info(
                        f"Successfully saved conversation history for user {input.user_id}",
                        extra={
                            'conversation_id': str(conversation_id),
                            'is_new_conversation': is_new_conversation,
                        },
                    )
                    logger.info(f"Save result: {result}")

                    # Link file attachments to the saved user message
                    if file_ids_for_update and result.status and result.user_message_id:
                        try:
                            update_input = UpdatingFileAttachmentMessageInput(
                                file_ids=file_ids_for_update,
                                message_id=result.user_message_id,
                                conversation_id=conversation_id,
                            )
                            await run_db_operation(
                                db_session_factory,
                                self.updating_file_attachment_message_service.process,
                                update_input,
                            )
                            logger.info(
                                f'Linked {len(file_ids_for_update)} file attachments '
                                f'to message {result.user_message_id}',
                            )
                        except Exception as link_error:
                            logger.error(
                                f'Failed to link file attachments: {link_error}',
                                exc_info=True,
                            )

                    # Trigger background task to generate title for new conversations
                    if is_new_conversation and conversation_id is not None:
                        logger.info(
                            f"Triggering background task to generate title for new conversation {conversation_id}",
                        )
                        create_background_task(
                            generate_and_update_conversation_title(
                                conversation_id=conversation_id,
                                first_message=clean_user_message,
                                settings=self.settings,
                                provider_llm=input.provider_llm,
                                db_session_factory=db_session_factory,
                            ),
                        )

                    # Store interaction in Mem0 for long-term personalization (async, non-blocking).
                    # Scoped by (user_id, chatbot_id) — see retrieve call above.
                    if self.settings.mem0.enabled:
                        create_background_task(
                            self.mem0_service.store_interaction(
                                user_message=clean_user_message,
                                ai_response=full_response,
                                user_id=_mem0_scope_id(input.user_id, input.chatbot_id),
                            ),
                        )
                except Exception as save_error:
                    logger.error(
                        f"Failed to save conversation history: {save_error}",
                        exc_info=True,
                        extra={
                            'user_id': input.user_id,
                            'query_length': len(original_message),
                            'response_length': len(full_response),
                        },
                    )
            elif not stream_completed:
                logger.warning(
                    'Stream did not complete successfully - skipping history save',
                )
            elif not full_response.strip():
                logger.warning('No content to save - full_response is empty')


async def generate_and_update_conversation_title(
    conversation_id: uuid.UUID,
    first_message: str,
    settings: Settings,
    provider_llm: str = DEFAULT_LLM_PROVIDER,
    db_session_factory: Callable | None = None,
) -> None:
    """Background task to generate and update conversation title using LLM.

    Runs asynchronously after the chat response is streamed. Uses the
    shared session factory to avoid creating orphan connection pools.

    Args:
        conversation_id: UUID of the conversation to update.
        first_message: First user message to generate title from.
        settings: Application settings.
        provider_llm: LLM provider to use for title generation.
        db_session_factory: Session factory for short-lived DB access.
    """
    try:
        logger.info(
            f"Background task: Generating title for conversation {conversation_id}",
        )

        # Generate title using LLM (run in thread pool to avoid blocking)
        title_service = TitleGenerationService(settings=settings)
        title_input = TitleGenerationInput(
            first_message=first_message,
            provider_llm=provider_llm,
        )

        title_result = await asyncio.to_thread(title_service.process, title_input)

        if not title_result.status or not title_result.title:
            logger.error(
                f"Failed to generate title for conversation {conversation_id}: {title_result.message}",
            )
            return

        generated_title = title_result.title
        logger.info(
            f"Generated title for conversation {conversation_id}: {generated_title}",
        )

        # Update conversation title via shared pool (no orphan pool creation)
        update_service = UpdatingConversationService(settings=settings.postgres)
        update_input = UpdatingConversationInput(
            conversation_id=conversation_id,
            title=generated_title,
        )

        if db_session_factory is not None:
            update_result = await run_db_operation(
                db_session_factory,
                update_service.process,
                update_input,
            )
        else:
            # Fallback: run with service-managed session (backward compat)
            update_result = await asyncio.to_thread(update_service.process, update_input)

        if update_result.status:
            logger.info(
                f"Successfully updated conversation {conversation_id} with title: {generated_title}",
            )
        else:
            logger.error(
                f"Failed to update conversation {conversation_id} title: {update_result.message}",
            )

    except Exception as e:
        logger.error(
            f"Exception in background task for conversation {conversation_id}: {str(e)}",
            exc_info=True,
        )
        # Don't raise - background tasks should not fail the main request
