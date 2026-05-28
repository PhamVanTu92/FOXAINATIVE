from __future__ import annotations

from typing import Annotated

from langgraph.graph import MessagesState
from pydantic import Field


def add_tokens(left: int, right: int) -> int:
    """Add token counts together."""
    return left + right


class ComparisonAgentState(MessagesState):
    """State of the Comparison graph / agent."""

    prompt_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the prompt',
    )
    completion_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the completion',
    )
