"""Comparison graph service for document analysis workflows.

Orchestrates document comparison using query rewriting, RAG retrieval,
and document listing via sub-graph with structured tool calls.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
from typing import Dict
from typing import List
from typing import Optional

from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from joint.utils import create_tool_node_with_fallback
from langchain_core.messages import ToolMessage
from langchain_core.tools import StructuredTool
from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import tools_condition
from langgraph.types import Command

from ..base_graph import BaseAgent
from ..base_graph import CompleteOrEscalate
from ...tools.document_tool import DocumentToolService
from ...tools.query_rewrite import DocumentInfo
from ...tools.query_rewrite import OutputFormat
from ...tools.query_rewrite import QueryRewriteInput
from ...tools.query_rewrite import QueryRewriteService
from ...tools.retriever import RetrieverInput
from ...tools.retriever import RetrieverService
from .prompts import SYSTEM_PROMPT
from .state import ComparisonAgentState

logger = get_logger(__name__)


class ComparisonService(BaseService):
    """Service for managing the comparison sub-graph workflow.

    Provides document comparison capabilities using:
    - rag_tool: Multi-query retrieval with query rewriting
    - list_documents_tool: Lists available documents via Index API
    - CompleteOrEscalate: Returns control to parent graph

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

    @property
    def _primary_collection(self) -> str:
        """First bound collection — used by single-collection helpers."""
        return self.collection_names[0] if self.collection_names else ''

    @property
    def _base_agent(self) -> BaseAgent:
        """Initializes and returns a BaseAgent instance."""
        return BaseAgent(
            settings=self.settings,
            provider_llm=self.provider_llm,
        )

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
    def _query_rewrite_service(self) -> QueryRewriteService:
        """Initializes and returns a QueryRewriteService instance."""
        return QueryRewriteService(
            settings=self.settings,
            provider_llm=self.provider_llm,
            collection_name=self._primary_collection,
        )

    @property
    def _document_tool_service(self) -> DocumentToolService:
        """Initializes and returns a DocumentToolService instance."""
        return DocumentToolService(
            settings=self.settings,
            collection_name=self._primary_collection,
        )

    @property
    def _create_workflow(self) -> StateGraph:
        """Create and configure the workflow graph."""
        return StateGraph(ComparisonAgentState)

    # ---- RAG Tool ----

    @property
    def rag_tool(self) -> StructuredTool:
        """Create the RAG comparison tool as a StructuredTool."""
        return self._create_rag_tool()

    def _create_rag_tool(self) -> StructuredTool:
        """Build StructuredTool for multi-query RAG comparison."""

        def rag_tool_func(
            document_names: List[str],
            comparison_purpose: str,
            important_keywords: List[str],
            comparison_topics: List[str],
            comparison_questions: Optional[List[str]] = None,
            priority_sections: Optional[List[str]] = None,
            preferred_output_format: OutputFormat = OutputFormat.COMPARISON_TABLE,
        ) -> Dict:
            """Synchronous wrapper for async RAG implementation."""
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(
                            asyncio.run,
                            self._rag_tool_implementation(
                                document_names=document_names,
                                comparison_topics=comparison_topics,
                                comparison_questions=comparison_questions,
                                priority_sections=priority_sections,
                                important_keywords=important_keywords,
                                comparison_purpose=comparison_purpose,
                                preferred_output_format=preferred_output_format,
                            ),
                        )
                        return future.result()
                else:
                    return loop.run_until_complete(
                        self._rag_tool_implementation(
                            document_names=document_names,
                            comparison_topics=comparison_topics,
                            comparison_questions=comparison_questions,
                            priority_sections=priority_sections,
                            important_keywords=important_keywords,
                            comparison_purpose=comparison_purpose,
                            preferred_output_format=preferred_output_format,
                        ),
                    )
            except RuntimeError:
                return asyncio.run(
                    self._rag_tool_implementation(
                        document_names=document_names,
                        comparison_topics=comparison_topics,
                        comparison_questions=comparison_questions,
                        priority_sections=priority_sections,
                        important_keywords=important_keywords,
                        comparison_purpose=comparison_purpose,
                        preferred_output_format=preferred_output_format,
                    ),
                )

        return StructuredTool.from_function(
            func=rag_tool_func,
            name='rag_tool',
            description='Perform RAG retrieval and document comparison analysis.',
            args_schema=DocumentInfo,
            return_direct=True,
        )

    async def _rag_tool_implementation(
        self,
        document_names: List[str],
        comparison_purpose: str,
        important_keywords: List[str],
        comparison_topics: List[str],
        comparison_questions: Optional[List[str]] = None,
        priority_sections: Optional[List[str]] = None,
        preferred_output_format: OutputFormat = OutputFormat.COMPARISON_TABLE,
    ) -> Dict:
        """Execute multi-query RAG retrieval for document comparison.

        1. Creates DocumentInfo and generates optimized queries via QueryRewriteService
        2. Executes primary, detail, and context queries against RetrieverService
        3. Aggregates and deduplicates artifacts for UI display

        Args:
            document_names: Names of documents to compare.
            comparison_purpose: Purpose of comparison.
            important_keywords: Keywords to track.
            comparison_topics: Topics to compare.
            comparison_questions: Specific questions to explore.
            priority_sections: Sections needing special attention.
            preferred_output_format: Desired output format.

        Returns:
            Dict with analysis_results containing query results and artifacts.
        """
        logger.info(
            f"Comparison RAG tool — docs={document_names}, "
            f"topics={comparison_topics}, purpose={comparison_purpose}",
        )

        try:
            # Build DocumentInfo and generate queries
            doc_info = DocumentInfo(
                document_names=document_names,
                comparison_topics=comparison_topics,
                comparison_questions=comparison_questions or [],
                priority_sections=priority_sections or [],
                important_keywords=important_keywords or [],
                comparison_purpose=comparison_purpose,
                preferred_output_format=preferred_output_format,
            )

            query_result = await self._query_rewrite_service.process(
                QueryRewriteInput(document_info=doc_info),
            )

            if not query_result.status:
                logger.error(f"Query rewrite failed: {query_result.message}")
                return {'error': query_result.message, 'status': 'failed'}

            # Execute retrieval for each generated query
            queries = [
                query_result.queries.primary_query,
                query_result.queries.detail_query,
                query_result.queries.context_query,
            ]
            query_types = ['primary', 'detail', 'context']
            document_name_filter = document_names or None

            all_results = []
            for i, (query, q_type) in enumerate(zip(queries, query_types)):
                logger.info(f"Executing {q_type} query: {query}")

                retriever_input = RetrieverInput(
                    query=query,
                    document_name_filter=document_name_filter,
                )
                result = await self._retriever_service.process(input=retriever_input)

                artifact = []
                if hasattr(result, 'documents') and result.documents:
                    artifact = self._filter_artifact_for_ui(
                        [doc.metadata for doc in result.documents],
                    )
                    logger.info(
                        f"Retrieved {len(result.documents)} docs, "
                        f"{len(artifact)} artifacts",
                    )

                all_results.append({
                    'query': query,
                    'query_type': q_type,
                    'results': result,
                    'artifact': artifact,
                    'filtered_documents': document_name_filter,
                })

            # Aggregate and deduplicate artifacts
            all_artifacts = []
            for r in all_results:
                all_artifacts.extend(r.get('artifact', []))

            unique_artifacts = []
            seen = set()
            for art in all_artifacts:
                pages = ','.join(map(str, art.get('page_number', [])))
                key = f"{art.get('document_name', '')}_{pages}"
                if key not in seen:
                    seen.add(key)
                    unique_artifacts.append(art)

            logger.info(
                f"Total artifacts: {len(all_artifacts)}, "
                f"unique: {len(unique_artifacts)}",
            )

            return {
                'analysis_results': {
                    'query_results': all_results,
                    'all_artifacts': unique_artifacts,
                    'filtered_documents': document_name_filter,
                    'total_queries_executed': len(queries),
                    'comparison_info': {
                        'documents': document_names,
                        'topics': comparison_topics,
                        'questions': comparison_questions,
                        'priority_sections': priority_sections,
                        'important_keywords': important_keywords,
                        'purpose': comparison_purpose,
                        'output_format': preferred_output_format,
                    },
                },
            }

        except Exception as e:
            logger.error(f"Error in rag_tool: {e}", exc_info=True)
            return {'error': str(e), 'status': 'failed'}

    @staticmethod
    def _filter_artifact_for_ui(metadata_list: List[Dict]) -> List[Dict]:
        """Filter metadata to essential fields for UI display.

        Args:
            metadata_list: Full metadata dictionaries from retriever.

        Returns:
            List of dicts with only: document_name, file_url,
            effective_from, effective_to, page_number.
        """
        return [
            {
                'document_name': m.get('document_name', 'N/A'),
                'file_url': m.get('file_url', 'N/A'),
                'effective_from': m.get('effective_from', 'N/A'),
                'effective_to': m.get('effective_to', 'N/A'),
                'page_number': m.get('page_number', []),
            }
            for m in metadata_list
        ]

    # ---- List Documents Tool ----

    @property
    def list_documents_tool(self) -> StructuredTool:
        """Create the list documents tool as a StructuredTool."""
        return self._create_list_documents_tool()

    def _create_list_documents_tool(self) -> StructuredTool:
        """Build StructuredTool for listing available documents."""

        async def list_documents_func(
            context: Optional[str] = None,
        ) -> str:
            return await self._list_documents_implementation()

        return StructuredTool.from_function(
            coroutine=list_documents_func,
            name='list_documents_tool',
            description=(
                'Retrieve the list of available documents in the collection. '
                'Use this to show the user which documents can be compared.'
            ),
            return_direct=True,
        )

    async def _list_documents_implementation(self) -> str:
        """Fetch document names from Index service and format as text.

        Returns:
            Formatted string listing all available documents.
        """
        result = await self._document_tool_service.process()

        if not result.status:
            return (
                f"Error retrieving documents: {result.message}. "
                f"Please try again later."
            )

        if result.total == 0:
            return (
                f"No documents found in collection '{self._primary_collection}'."
            )

        doc_list = '\n'.join(
            f"  {i + 1}. {name}"
            for i, name in enumerate(result.document_names)
        )
        return (
            f"Found {result.total} document(s) in collection "
            f"'{self._primary_collection}':\n\n{doc_list}"
        )

    # ---- Custom Tool Nodes ----

    def _create_rag_tool_node_with_artifact_support(self):
        """Create custom node for rag_tool that handles artifact extraction.

        The node:
        1. Invokes rag_tool
        2. Extracts filtered artifact data
        3. Attaches minimal artifact to ToolMessage for UI
        """

        async def rag_tool_node(state: ComparisonAgentState):
            logger.info('--- RAG TOOL NODE (COMPARISON) ---')
            new_messages = []

            for tool_call in state['messages'][-1].tool_calls:
                if tool_call['name'] != 'rag_tool':
                    continue

                try:
                    result = await self.rag_tool.ainvoke(tool_call['args'])

                    artifact = []
                    if isinstance(result, dict) and 'analysis_results' in result:
                        analysis = result['analysis_results']
                        artifact = analysis.get('all_artifacts', [])
                        logger.info(
                            f"Extracted {len(artifact)} artifacts",
                        )

                    content = (
                        f"Analysis completed. Retrieved "
                        f"{len(artifact)} unique document sources."
                    )
                    if isinstance(result, dict) and 'analysis_results' in result:
                        analysis = result['analysis_results']
                        content += (
                            f"\nQueries executed: "
                            f"{analysis.get('total_queries_executed', 0)}"
                        )
                        docs = analysis.get('filtered_documents', [])
                        if docs:
                            content += (
                                f"\nDocuments analyzed: {', '.join(docs)}"
                            )

                    tool_msg = ToolMessage(
                        content=content,
                        tool_call_id=tool_call['id'],
                        name=tool_call['name'],
                    )
                    tool_msg.artifact = artifact  # type: ignore[attr-defined]
                    new_messages.append(tool_msg)

                except Exception as e:
                    logger.error(f"Error in rag_tool_node: {e}", exc_info=True)
                    tool_msg = ToolMessage(
                        content=f'Error analyzing documents: {e}',
                        tool_call_id=tool_call['id'],
                        name=tool_call['name'],
                    )
                    tool_msg.artifact = []  # type: ignore[attr-defined]
                    new_messages.append(tool_msg)

            return {'messages': new_messages}

        return rag_tool_node

    # ---- Graph Construction ----

    @property
    async def process(self) -> CompiledGraph:
        """Build and compile the comparison sub-graph.

        Graph structure:
        - START → comparison_agent
        - comparison_agent → {rag_tool, list_documents_tool, leave_skill, END}
        - rag_tool → comparison_agent
        - list_documents_tool → comparison_agent
        - leave_skill → END (pops dialog_state to parent)

        Returns:
            CompiledGraph: Compiled sub-graph (without checkpointer).
        """
        tools = [self.rag_tool, self.list_documents_tool, CompleteOrEscalate]

        async def comparison_agent(state):
            base_agent_instance = self._base_agent
            return await base_agent_instance(
                state=state,
                tools=tools,
                system_prompt=SYSTEM_PROMPT,
            )

        workflow_graph = self._create_workflow

        # Nodes
        workflow_graph.add_node('comparison_agent', comparison_agent)
        workflow_graph.add_node(
            'rag_tool',
            self._create_rag_tool_node_with_artifact_support(),
        )
        workflow_graph.add_node(
            'list_documents_tool',
            create_tool_node_with_fallback([self.list_documents_tool]),
        )
        workflow_graph.add_node('leave_skill', self._pop_dialog_state)

        # Edges
        workflow_graph.add_edge(START, 'comparison_agent')
        workflow_graph.add_edge('leave_skill', END)
        workflow_graph.add_edge('rag_tool', 'comparison_agent')
        workflow_graph.add_edge('list_documents_tool', 'comparison_agent')

        workflow_graph.add_conditional_edges(
            'comparison_agent',
            self._route_after_llm,
            {
                'leave_skill': 'leave_skill',
                'rag_tool': 'rag_tool',
                'list_documents_tool': 'list_documents_tool',
                END: END,
            },
        )

        app = workflow_graph.compile()
        app.name = 'comparison_agent'
        return app

    # ---- Routing ----

    def _route_after_llm(self, state: ComparisonAgentState) -> str:
        """Route after LLM response in comparison sub-graph.

        Args:
            state: Current comparison agent state.

        Returns:
            str: Target node name.
        """
        route = tools_condition(state)
        if route == END:
            return END

        tool_calls = state['messages'][-1].tool_calls
        if any(tc['name'] == CompleteOrEscalate.__name__ for tc in tool_calls):
            return 'leave_skill'
        if tool_calls:
            tool_name = tool_calls[0]['name']
            if tool_name == self.rag_tool.name:
                return 'rag_tool'
            if tool_name == self.list_documents_tool.name:
                return 'list_documents_tool'

        raise ValueError('Invalid route in comparison graph')

    @staticmethod
    def _pop_dialog_state(state: ComparisonAgentState) -> Command:
        """Pop dialog stack and return to parent agentic_agent.

        Creates ToolMessage responses for any pending tool calls and
        issues a Command to return control to the parent graph.

        Args:
            state: Current comparison agent state.

        Returns:
            Command: Parent graph command with 'pop' dialog_state.
        """
        tool_messages = []
        if state['messages'][-1].tool_calls:
            for tool_call in state['messages'][-1].tool_calls:
                tool_messages.append(
                    ToolMessage(
                        content=(
                            'Resuming dialog with the host assistant. '
                            'Please reflect on the past conversation and '
                            'assist the user as needed.'
                        ),
                        tool_call_id=tool_call['id'],
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
