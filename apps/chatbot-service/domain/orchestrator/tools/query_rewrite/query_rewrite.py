"""Query rewrite service for document comparison.

Generates optimized RAG queries from document comparison parameters
using LLM structured output.
"""
from __future__ import annotations

from enum import Enum
from typing import List
from typing import Optional

from infrastructure.llm import BaseLLMInput
from infrastructure.llm import LLMInput
from infrastructure.llm import LLMService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings
from pydantic import Field

from .prompt import SYSTEM_PROMPT
from .prompt import USER_PROMPT_TEMPLATE

logger = get_logger(__name__)


class OutputFormat(str, Enum):
    """Supported output formats for document comparison results."""

    SUMMARY_REPORT = 'summary_report'
    HIGHLIGHT_DIFF = 'highlight_diff'
    COMPARISON_TABLE = 'comparison_table'


class DocumentInfo(BaseModel):
    """Information required for document comparison — user-provided parameters."""

    document_names: List[str] = Field(
        ..., min_length=2,
        description='Names of documents to compare',
    )
    comparison_topics: List[str] = Field(
        ..., min_length=1,
        description='Specific topics/content to compare',
    )
    comparison_questions: List[str] = Field(
        default_factory=list,
        description='Specific questions to explore through comparison',
    )
    priority_sections: List[str] = Field(
        default_factory=list,
        description='Important sections that need special attention',
    )
    important_keywords: List[str] = Field(
        default_factory=list,
        description='Important keywords to track',
    )
    comparison_purpose: str = Field(
        ...,
        description='Purpose of comparison (find changes, version checking, etc.)',
    )
    preferred_output_format: OutputFormat = Field(
        OutputFormat.COMPARISON_TABLE,
        description='Desired output format',
    )


class QueryRouter(BaseModel):
    """Structured output model for generated comparison queries."""

    primary_query: str = Field(
        ...,
        description='Main query to search for core comparison information',
    )
    detail_query: str = Field(
        ...,
        description='Detailed query for specific aspects of interest',
    )
    context_query: str = Field(
        ...,
        description='Context query for additional background information',
    )
    reasoning: Optional[str] = Field(
        None,
        description='Reasoning behind query selection',
    )


class QueryRewriteInput(BaseModel):
    """Input model for QueryRewriteService."""

    document_info: DocumentInfo = Field(
        ...,
        description='Document comparison information',
    )


class QueryRewriteOutput(BaseModel):
    """Output model for QueryRewriteService."""

    queries: QueryRouter = Field(..., description='Generated queries')
    status: bool = Field(..., description='Success or failure status')
    message: Optional[str] = Field(None, description='Error message if any')


class QueryRewriteService(BaseService):
    """Service for generating optimized RAG queries from comparison parameters.

    Uses LLM structured output to produce primary, detail, and context queries
    tailored to the document comparison request.

    Attributes:
        settings: Application settings.
        provider_llm: LLM provider name.
        collection_name: Target collection name.
    """

    settings: Settings
    provider_llm: str
    collection_name: str

    @property
    def _llm_service(self) -> LLMService:
        """Initializes and returns an LLM service instance."""
        return LLMService(settings=self.settings)

    async def process(self, input: QueryRewriteInput) -> QueryRewriteOutput:
        """Generate optimized queries from document comparison info.

        Args:
            input: QueryRewriteInput with document comparison parameters.

        Returns:
            QueryRewriteOutput with generated queries and status.
        """
        try:
            doc_info = input.document_info

            user_prompt = USER_PROMPT_TEMPLATE.format(
                document_names=', '.join(doc_info.document_names),
                comparison_topics=', '.join(doc_info.comparison_topics),
                comparison_questions=', '.join(doc_info.comparison_questions),
                priority_sections=', '.join(doc_info.priority_sections),
                important_keywords=', '.join(doc_info.important_keywords),
                comparison_purpose=doc_info.comparison_purpose,
                preferred_output_format=doc_info.preferred_output_format.value,
            )

            # Use structured output via LLM service
            base_llm_input = BaseLLMInput(router=QueryRouter)
            llm_input = LLMInput(
                base_llm_input=base_llm_input,
                provider_name=self.provider_llm,
            )

            llm_result = self._llm_service.process(llm_input)
            llm_chain = llm_result.base_llm_output.chain

            result = await llm_chain.ainvoke({
                'system_prompt': SYSTEM_PROMPT,
                'query': user_prompt,
            })

            logger.info(
                f'Generated queries: primary={result.primary_query}, '
                f'detail={result.detail_query}, context={result.context_query}',
            )

            return QueryRewriteOutput(
                queries=result,
                status=True,
                message='Queries generated successfully',
            )

        except Exception as e:
            logger.error(f"Error in query rewrite: {e}")
            return QueryRewriteOutput(
                queries=QueryRouter(
                    primary_query='',
                    detail_query='',
                    context_query='',
                    reasoning=f'Error: {e}',
                ),
                status=False,
                message=f'Failed to generate queries: {e}',
            )
