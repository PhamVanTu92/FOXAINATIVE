"""RAG graph service for knowledge base retrieval workflow.

Provides a LangGraph sub-graph that handles Q&A retrieval from the
vector store, with section-aware search and artifact extraction.
"""
from __future__ import annotations

import asyncio
from typing import Dict
from typing import List
from typing import Optional

from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from joint.utils import create_tool_node_with_fallback
from langchain_core.messages import ToolMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import StructuredTool
from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import tools_condition
from langgraph.types import Command

from ..base_graph import BaseAgent
from ..base_graph import CompleteOrEscalate
from .prompts import SYSTEM_PROMPT
from .state import RAGAgentState
from ...tools import RetrieverInput
from ...tools import RetrieverService
from ...tools import CollectionDescriptionService

logger = get_logger(__name__)


class RagService(BaseService):
    """Service for building and managing the RAG sub-graph.

    Creates a LangGraph workflow that uses retriever tool for
    knowledge base search with section-aware capabilities.

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
    # Knowledge base names bound to the chatbot (1..N).
    collection_names: List[str]

    @property
    def _primary_collection(self) -> str:
        """First bound collection — used for single-collection helpers."""
        return self.collection_names[0] if self.collection_names else ''

    @property
    def _retriever_service(self) -> RetrieverService:
        """Initializes and returns a RetrieverService instance."""
        return RetrieverService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
            collection_names=self.collection_names,
        )

    @property
    def _base_agent(self) -> BaseAgent:
        """Initializes and returns a BaseAgent instance."""
        return BaseAgent(
            settings=self.settings,
            provider_llm=self.provider_llm,
        )

    @property
    def _collection_description_service(self) -> CollectionDescriptionService:
        """CollectionDescriptionService — uses the primary collection for prompt context."""
        return CollectionDescriptionService(
            settings=self.settings,
            collection_name=self._primary_collection,
        )

    @property
    def _create_workflow(self) -> StateGraph:
        """Create and configure the workflow graph."""
        return StateGraph(RAGAgentState)

    # ── Tool creation ──────────────────────────────────────────────

    @property
    def retriever_tool(self) -> StructuredTool:
        """Create the retriever tool as a StructuredTool."""
        if not hasattr(self, '_retriever_tool_instance'):
            self._retriever_tool_instance = self._create_retriever_tool()
        return self._retriever_tool_instance

    def _create_retriever_tool(self) -> StructuredTool:
        """Build a section-aware retriever StructuredTool.

        Returns:
            StructuredTool wrapping the retriever implementation.
        """

        def retriever_func(
            query: str,
            document_name_filter: Optional[List[str]] = None,
            retrieval_mode: Optional[str] = 'balanced',
            expand_by_section: Optional[bool] = False,
            section_keywords: Optional[List[str]] = None,
            max_chunks: Optional[int] = 8,
        ) -> tuple:
            return asyncio.run(self._retriever_tool_implementation(
                query=query,
                document_name_filter=document_name_filter,
                retrieval_mode=retrieval_mode,
                expand_by_section=expand_by_section,
                section_keywords=section_keywords,
                max_chunks=max_chunks,
            ))

        async def retriever_afunc(
            query: str,
            document_name_filter: Optional[List[str]] = None,
            retrieval_mode: Optional[str] = 'balanced',
            expand_by_section: Optional[bool] = False,
            section_keywords: Optional[List[str]] = None,
            max_chunks: Optional[int] = 8,
        ) -> tuple:
            return await self._retriever_tool_implementation(
                query=query,
                document_name_filter=document_name_filter,
                retrieval_mode=retrieval_mode,
                expand_by_section=expand_by_section,
                section_keywords=section_keywords,
                max_chunks=max_chunks,
            )

        return StructuredTool.from_function(
            func=retriever_func,
            coroutine=retriever_afunc,
            name='retriever_tool',
            description=(
                'Retrieve relevant document chunks from the configured knowledge base(s).\n\n'
                'Parameters:\n'
                '- query (required): The search query\n'
                '- document_name_filter (optional): List of specific document names to search in\n'
                '- retrieval_mode (optional): "balanced" (default), "section_focused", or "diversity"\n'
                '- expand_by_section (optional): True to include all chunks from relevant sections\n'
                '- section_keywords (optional): Section keywords if user mentions specific sections\n'
                '- max_chunks (optional): Maximum chunks to return (default: 8)\n\n'
                'Returns both content and artifact (metadata sources).'
            ),
            return_direct=True,
        )

    # ── Tool implementations ───────────────────────────────────────

    async def _retriever_tool_implementation(
        self,
        query: str,
        document_name_filter: Optional[List[str]] = None,
        retrieval_mode: Optional[str] = 'balanced',
        expand_by_section: Optional[bool] = False,
        section_keywords: Optional[List[str]] = None,
        max_chunks: Optional[int] = 8,
    ) -> tuple:
        """Execute retrieval and format results with metadata.

        Returns:
            Tuple of (content_text, artifact_metadata).
        """
        retriever_input = RetrieverInput(
            query=query,
            document_name_filter=document_name_filter,
            retrieval_mode=retrieval_mode,
            expand_by_section=expand_by_section,
            section_keywords=section_keywords,
            max_chunks=max_chunks,
        )
        result = await self._retriever_service.process(input=retriever_input)

        # Format content with metadata for LLM citation
        doc_prompt = PromptTemplate.from_template(
            '{page_content}\n\n'
            '[Source: {document_name}, Page: {page_number}, '
            'Effective: {effective_from} to {effective_to}, '
            'URL: {file_url}]',
        )
        separator = '\n\n---\n\n'

        content_parts = []
        for doc in result.documents:
            meta = doc.metadata or {}
            context = {
                'page_content': doc.page_content,
                'document_name': meta.get('document_name', 'N/A'),
                'page_number': ', '.join(
                    map(str, meta.get('page_number', ['N/A'])),
                ),
                'effective_from': meta.get('effective_from', 'N/A'),
                'effective_to': meta.get('effective_to', 'N/A'),
                'file_url': meta.get('file_url', 'N/A'),
            }
            content_parts.append(doc_prompt.format(**context))

        content = separator.join(content_parts)

        # Extract filtered artifact for UI
        artifact = self._filter_artifact_for_ui(
            [doc.metadata for doc in result.documents],
        )

        logger.info(
            f'Retriever returned {len(result.documents)} documents '
            f'with {len(artifact)} unique artifacts',
        )
        return content, artifact

    def _filter_artifact_for_ui(self, metadata_list: List[Dict]) -> List[Dict]:
        """Filter and deduplicate metadata for UI display.

        Args:
            metadata_list: Raw metadata from retrieved documents.

        Returns:
            Deduplicated list with essential fields only.
        """
        filtered: List[Dict] = []
        seen: set = set()

        for meta in metadata_list:
            if not meta:
                continue
            doc_name = meta.get('document_name', 'N/A')
            pages = tuple(sorted(meta.get('page_number', [])))
            key = (doc_name, pages)

            if key in seen:
                continue
            seen.add(key)

            filtered.append({
                'document_name': doc_name,
                'file_url': meta.get('file_url', 'N/A'),
                'effective_from': meta.get('effective_from', 'N/A'),
                'effective_to': meta.get('effective_to', 'N/A'),
                'page_number': meta.get('page_number', []),
            })

        return filtered

    # ── Custom retriever node ─────────────────────────────────────

    def _create_retriever_node(self):
        """Create custom node that unpacks (content, artifact) tuple.

        Returns:
            Async function suitable as a LangGraph node.
        """

        async def retriever_node(state: RAGAgentState):
            """Invoke retriever tool and attach artifact to ToolMessage."""
            logger.info('---RETRIEVER TOOL NODE---')
            new_messages = []

            for tool_call in state['messages'][-1].tool_calls:
                if tool_call['name'] != 'retriever_tool':
                    continue
                try:
                    result = await self.retriever_tool.ainvoke(tool_call['args'])
                    if isinstance(result, tuple) and len(result) == 2:
                        content, artifact = result
                    else:
                        content, artifact = str(result), []

                    tool_msg = ToolMessage(
                        content=content,
                        tool_call_id=tool_call['id'],
                        name=tool_call['name'],
                    )
                    tool_msg.artifact = artifact  # type: ignore[attr-defined]
                    new_messages.append(tool_msg)

                except Exception as e:
                    logger.error(f'Error in retriever_node: {e}', exc_info=True)
                    tool_msg = ToolMessage(
                        content=f'Error retrieving documents: {e}',
                        tool_call_id=tool_call['id'],
                        name=tool_call['name'],
                    )
                    tool_msg.artifact = []  # type: ignore[attr-defined]
                    new_messages.append(tool_msg)

            return {'messages': new_messages}

        return retriever_node

    # ── Graph construction ────────────────────────────────────────

    @property
    async def process(self) -> CompiledGraph:
        """Build and compile the RAG sub-graph.

        Returns:
            Compiled sub-graph named 'rag_agent'.
        """
        # Fetch collection description for system prompt injection
        desc_result = await self._collection_description_service.process()
        collection_description = (
            desc_result.description
            if desc_result.status and desc_result.description
            else 'Operator-configured knowledge base'
        )

        tools = [self.retriever_tool, CompleteOrEscalate]

        async def rag_agent(state):
            return await self._base_agent(
                state=state,
                tools=tools,
                system_prompt=SYSTEM_PROMPT,
                collection_description=collection_description,
            )

        workflow = self._create_workflow
        workflow.add_node('rag_agent', rag_agent)
        workflow.add_node('retriever_tool', self._create_retriever_node())
        workflow.add_node('leave_skill', self._pop_dialog_state)

        workflow.add_edge(START, 'rag_agent')
        workflow.add_edge('leave_skill', END)
        workflow.add_edge('retriever_tool', 'rag_agent')

        workflow.add_conditional_edges(
            'rag_agent',
            self._route_after_llm,
            {
                'leave_skill': 'leave_skill',
                'retriever_tool': 'retriever_tool',
                END: END,
            },
        )

        app = workflow.compile()
        app.name = 'rag_agent'
        return app

    # ── Routing ───────────────────────────────────────────────────

    def _route_after_llm(self, state: RAGAgentState):
        """Route after LLM response: tool call, escalate, or end."""
        route = tools_condition(state)
        if route == END:
            return END

        tool_calls = state['messages'][-1].tool_calls
        if any(tc['name'] == CompleteOrEscalate.__name__ for tc in tool_calls):
            return 'leave_skill'
        if tool_calls:
            tool_name = tool_calls[0]['name']
            if tool_name == self.retriever_tool.name:
                return 'retriever_tool'

        raise ValueError('Invalid route in RAG graph')

    @staticmethod
    def _pop_dialog_state(state: RAGAgentState) -> Command:
        """Pop dialog stack and return control to parent graph.

        Returns:
            Command to navigate back to agentic_agent in parent graph.
        """
        tool_messages = []
        if state['messages'][-1].tool_calls:
            for tc in state['messages'][-1].tool_calls:
                tool_messages.append(
                    ToolMessage(
                        content='Resuming dialog with the host assistant. '
                        'Please reflect on the past conversation and assist the user as needed.',
                        tool_call_id=tc['id'],
                    ),
                )

        return Command(
            goto='agentic_agent',
            graph=Command.PARENT,
            update={
                'dialog_state': 'pop',
                'messages': state['messages'] + tool_messages,
            },
        )
