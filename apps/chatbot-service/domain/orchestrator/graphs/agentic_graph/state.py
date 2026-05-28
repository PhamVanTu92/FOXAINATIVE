from __future__ import annotations

from typing import Annotated
from typing import Optional

from langgraph.graph import MessagesState
from pydantic import Field


def update_dialog_stack(left: list[str], right: Optional[str]) -> list[str]:
    """Push or pop the state."""
    if right is None:
        return left
    if right == 'pop':
        return left[:-1]
    return left + [right]


def add_tokens(left: int, right: int) -> int:
    """Add token counts together."""
    return left + right


class AgenticState(MessagesState):
    """State of the retrieval graph / agent."""

    dialog_state: Annotated[
        list[str],
        update_dialog_stack,
    ]
    prompt_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the prompt',
    )
    completion_token: Annotated[int, add_tokens] = Field(
        default=0, description='Number of tokens in the completion',
    )
    memory_context: str = Field(
        default='', description='Mem0 personalization context injected into system prompt',
    )
