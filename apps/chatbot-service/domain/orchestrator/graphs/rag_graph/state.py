from __future__ import annotations

from typing import Annotated

from langgraph.graph import MessagesState
from pydantic import Field


def add_tokens(left: int, right: int) -> int:
    """Add token counts together."""
    return left + right


class RAGAgentState(MessagesState):
    """State for the RAG agent sub-graph.

    Tracks token usage across LLM calls within the RAG workflow.

    Attributes:
        prompt_token: Cumulative prompt token count.
        completion_token: Cumulative completion token count.
    """

    prompt_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the prompt',
    )
    completion_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the completion',
    )
