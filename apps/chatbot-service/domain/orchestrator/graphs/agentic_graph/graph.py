"""Agentic graph service for LangGraph workflow management.

Orchestrates sub-graph routing between RAG and Comparison agents
using dialog_state stack with handoff tools pattern.
"""
from __future__ import annotations

import time
from typing import Dict
from typing import List
from typing import Optional

from dotenv import load_dotenv
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from joint.utils import create_handoff_tool
from joint.utils import create_tool_node_with_fallback
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import tools_condition

from ..base_graph import BaseAgent
from ..comparison_graph import ComparisonService
from ..rag_graph import RagService
from ...tools import CollectionDescriptionService
from .prompts import SYSTEM_PROMPT
from .state import AgenticState

load_dotenv(override=True)
logger = get_logger(__name__)

# Graph workflow cache - stores uncompiled workflows for reuse
# Key: (provider_llm, provider_storage, provider_embedding, collection_name, user_id)
# Value: {"workflow": StateGraph, "created_at": timestamp, "last_used": timestamp}
_GRAPH_CACHE: Dict[tuple, dict] = {}

# Cache configuration
CACHE_TTL_SECONDS = 86400  # 24 hours
MAX_CACHE_SIZE = 100


class AgenticService(BaseService):
    """
    Service for managing agentic graph workflow with sub-graph routing.

    Orchestrates routing between specialized sub-graphs (RAG, Comparison)
    via dialog_state stack and handoff tools pattern.
    Memory persistence is delegated to external checkpointer (Redis).

    Attributes:
        settings: Application settings.
        provider_llm: LLM provider name.
        provider_storage: Storage provider name.
        provider_embedding: Embedding provider name.
        collection_name: Collection name for retrieval.
    """

    settings: Settings
    provider_llm: str
    provider_storage: str
    provider_embedding: str
    collection_names: List[str]
    # Optional per-chatbot prompt augmentations (foxai-native).
    chatbot_instructions: str = ''
    faq_block: str = ''

    @property
    def _primary_collection(self) -> str:
        """First bound collection — used for prompt context / cache key."""
        return self.collection_names[0] if self.collection_names else ''

    @property
    def _base_agent(self) -> BaseAgent:
        """Initializes and returns a BaseAgent instance."""
        return BaseAgent(
            settings=self.settings,
            provider_llm=self.provider_llm,
        )

    @property
    def _rag_service(self) -> RagService:
        """Initializes and returns a RagService instance."""
        return RagService(
            settings=self.settings,
            provider_llm=self.provider_llm,
            provider_embedding=self.provider_embedding,
            provider_storage=self.provider_storage,
            collection_names=self.collection_names,
        )

    @property
    def _comparison_service(self) -> ComparisonService:
        """Initializes and returns a ComparisonService instance."""
        return ComparisonService(
            settings=self.settings,
            provider_llm=self.provider_llm,
            provider_embedding=self.provider_embedding,
            provider_storage=self.provider_storage,
            collection_names=self.collection_names,
        )

    @property
    def _collection_description_service(self) -> CollectionDescriptionService:
        """Initializes and returns a CollectionDescriptionService instance."""
        return CollectionDescriptionService(
            settings=self.settings,
            collection_name=self._primary_collection,
        )

    @property
    def _create_workflow(self) -> StateGraph:
        """Create and configure the workflow graph."""
        return StateGraph(AgenticState)

    async def process(
        self,
        checkpointer: BaseCheckpointSaver,
        user_id: Optional[str] = None,
    ) -> CompiledGraph:
        """
        Get or create cached graph instance with sub-graph routing.

        Builds a multi-agent workflow with:
        - agentic_agent: Central router node
        - rag_agent: RAG sub-graph for information retrieval
        - comparison_agent: Comparison sub-graph for document analysis
        - tool_node: Handles handoff tool invocations

        Args:
            checkpointer: External checkpointer for memory persistence.
            user_id: User ID for cache isolation.

        Returns:
            CompiledGraph: Compiled graph instance ready for execution.
        """
        cache_key = (
            self.provider_llm,
            self.provider_storage,
            self.provider_embedding,
            tuple(self.collection_names),
            # chatbot-specific bits — different bots must not share a workflow.
            hash(self.chatbot_instructions or ''),
            hash(self.faq_block or ''),
            user_id or 'default',
        )

        self._cleanup_expired_cache()

        # Check for cached workflow
        if cache_key in _GRAPH_CACHE:
            cache_entry = _GRAPH_CACHE[cache_key]
            current_time = time.time()

            if current_time - cache_entry['created_at'] < CACHE_TTL_SECONDS:
                cache_entry['last_used'] = current_time
                logger.debug(f"Using cached workflow for config: {cache_key}")
                app = cache_entry['workflow'].compile(
                    checkpointer=checkpointer,
                )
                app.name = 'agentic_agent'
                return app
            else:
                del _GRAPH_CACHE[cache_key]
                logger.info(
                    f"Removed expired cache entry for config: {cache_key}",
                )

        logger.info(f"Creating new workflow for config: {cache_key}")

        if len(_GRAPH_CACHE) >= MAX_CACHE_SIZE:
            self._evict_oldest_cache_entry()

        # Fetch collection description for system prompt injection
        desc_result = await self._collection_description_service.process()
        collection_description = (
            desc_result.description
            if desc_result.status and desc_result.description
            else 'Operator-configured knowledge base'
        )

        # Build sub-graphs (compiled without checkpointer)
        rag_graph = await self._rag_service.process
        comparison_graph = await self._comparison_service.process

        # Create handoff tools for delegation
        tools = [
            create_handoff_tool(
                agent_name=rag_graph.name,
                description=(
                    'Handle ALL information retrieval and factual queries. '
                    'Use for: knowledge base search, document content questions, '
                    'product information, interest rates, fees, banking operations, '
                    'technical support, FAQs, how-to questions, and any general '
                    'informational requests.'
                ),
            ),
            create_handoff_tool(
                agent_name=comparison_graph.name,
                description=(
                    'Handle document comparison and detailed analysis tasks. '
                    'Use for: comparing documents, analyzing differences between '
                    'products or policies, side-by-side analysis, structured '
                    'comparison queries, "X versus Y" requests.'
                ),
            ),
        ]

        # Per-chatbot extras (foxai-native): empty strings when called from
        # the legacy single-collection path.
        chatbot_instructions = self.chatbot_instructions or ''
        faq_block = self.faq_block or ''
        logger.info(
            f'Agentic prompt context: collections={self.collection_names}, '
            f'has_chatbot_instructions={bool(chatbot_instructions)} '
            f'(len={len(chatbot_instructions)}), '
            f'has_faq={bool(faq_block)}, '
            f'collection_description={collection_description!r}',
        )

        # Create wrapper function for the agentic agent
        async def agentic_agent(state):
            base_agent_instance = self._base_agent
            return await base_agent_instance(
                state=state,
                tools=tools,
                system_prompt=SYSTEM_PROMPT,
                memoryContext=state.get('memory_context', ''),
                collection_description=collection_description,
                chatbot_instructions=chatbot_instructions,
                faq_block=faq_block,
            )

        # Build workflow graph with sub-graph nodes
        workflow_graph = self._create_workflow
        workflow_graph.add_node('agentic_agent', agentic_agent)
        workflow_graph.add_node(
            'tool_node', create_tool_node_with_fallback(tools),
        )
        workflow_graph.add_node(rag_graph.name, rag_graph)
        workflow_graph.add_node(comparison_graph.name, comparison_graph)

        # Routing: START → route based on dialog_state stack
        workflow_graph.add_conditional_edges(
            START,
            self.route_to_workflow,
            [
                'agentic_agent',
                rag_graph.name,
                comparison_graph.name,
            ],
        )

        # Routing: agentic_agent → tool_node or END
        workflow_graph.add_conditional_edges(
            'agentic_agent',
            self.route_after_llm,
            ['tool_node', END],
        )

        # Cache the workflow (not compiled graph)
        current_time = time.time()
        _GRAPH_CACHE[cache_key] = {
            'workflow': workflow_graph,
            'created_at': current_time,
            'last_used': current_time,
        }

        # Compile with provided checkpointer
        app = workflow_graph.compile(checkpointer=checkpointer)
        app.name = 'agentic_agent'

        logger.info(f"Cached workflow for config: {cache_key}")
        return app

    def route_to_workflow(self, state: AgenticState) -> str:
        """Route to the appropriate sub-graph based on dialog_state stack.

        If dialog_state is empty, route to the main agentic_agent.
        Otherwise, route to the last pushed sub-graph.

        Args:
            state: Current graph state containing dialog_state.

        Returns:
            str: Name of the target node.
        """
        dialog_state = state.get('dialog_state', [])
        if not dialog_state:
            return 'agentic_agent'
        return dialog_state[-1]

    def route_after_llm(self, state: AgenticState) -> str:
        """Route after LLM response — to tool_node if tools called, else END.

        Args:
            state: Current graph state with messages.

        Returns:
            str: 'tool_node' if tool calls present, otherwise END.
        """
        route = tools_condition(state)
        if route == END:
            return END
        tool_calls = state['messages'][-1].tool_calls
        if tool_calls:
            return 'tool_node'
        raise ValueError('Invalid route: no tool calls found')

    
    @classmethod
    def _cleanup_expired_cache(cls) -> None:
        """Remove expired cache entries."""
        current_time = time.time()
        expired_keys = [
            key for key, entry in _GRAPH_CACHE.items()
            if current_time - entry['created_at'] > CACHE_TTL_SECONDS
        ]
        for key in expired_keys:
            del _GRAPH_CACHE[key]
            logger.info(f"Removed expired cache entry: {key}")

    @classmethod
    def _evict_oldest_cache_entry(cls) -> None:
        """Remove the oldest cache entry to make room for new one."""
        if not _GRAPH_CACHE:
            return
        oldest_key = min(
            _GRAPH_CACHE.keys(),
            key=lambda k: _GRAPH_CACHE[k]['last_used'],
        )
        del _GRAPH_CACHE[oldest_key]
        logger.info(f"Evicted oldest cache entry: {oldest_key}")

    @classmethod
    def clear_graph_cache(cls) -> None:
        """Clear the graph workflow cache."""
        global _GRAPH_CACHE
        _GRAPH_CACHE.clear()
        logger.info('Cleared graph cache')

    @classmethod
    def get_cache_info(cls) -> dict:
        """Get cache information for debugging.

        Returns:
            dict: Cache statistics including size, TTL, and entry details.
        """
        current_time = time.time()
        entries_info = {}
        for key, entry in _GRAPH_CACHE.items():
            age_seconds = current_time - entry['created_at']
            last_used_seconds = current_time - entry['last_used']
            entries_info[str(key)] = {
                'age_seconds': age_seconds,
                'last_used_seconds': last_used_seconds,
                'is_expired': age_seconds > CACHE_TTL_SECONDS,
            }
        return {
            'cache_size': len(_GRAPH_CACHE),
            'max_cache_size': MAX_CACHE_SIZE,
            'ttl_seconds': CACHE_TTL_SECONDS,
            'entries': entries_info,
        }
