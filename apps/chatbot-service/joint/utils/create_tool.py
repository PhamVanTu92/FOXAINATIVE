from __future__ import annotations

from typing import Optional

from joint.logging import get_logger
from langchain_core.tools import BaseTool
from langchain_core.tools import StructuredTool
from pydantic import BaseModel
from pydantic import Field

logger = get_logger(__name__)


class HandoffInput(BaseModel):
    """Input schema for handoff tools - ensures arguments field is always present."""
    context: Optional[str] = Field(
        default=None,
        description='Optional context or additional information for the handoff',
    )


class HandoffTool(StructuredTool):
    """Custom StructuredTool that marks itself as a handoff tool."""
    target_agent: str = ''

    class Config:
        arbitrary_types_allowed = True
        extra = 'allow'  # Allow extra fields

    @property
    def is_handoff(self) -> bool:
        return True


def create_handoff_tool(*, agent_name: str, description: str | None = None) -> BaseTool:
    """Create a tool that can handoff control to the requested agent.

    Args:
        agent_name: The name of the agent to handoff control to, i.e.
            the name of the agent node in the multi-agent graph.
            Agent names should be simple, clear and unique, preferably in snake_case,
            although you are only limited to the names accepted by LangGraph
            nodes as well as the tool names accepted by LLM providers
            (the tool name will look like this: `transfer_to_<agent_name>`).
        description: Optional description for the handoff tool.
    """
    if description is None:
        description = f"Ask agent '{agent_name}' for help"

    def handoff_function(context: Optional[str] = None):
        """
        Handoff control to another agent.

        Args:
            context: Optional context from the LLM

        Returns:
            A simple string that will be used to create ToolMessage by ToolNode
        """
        logger.info(
            f"[{agent_name}] Handoff tool called with context: {context}",
        )

        # Return a simple string - ToolNode will automatically create ToolMessage
        # with correct tool_call_id
        return (
            f"The assistant is now the {agent_name}. Reflect on the above conversation between the host assistant and the user."
            f" The user's intent is unsatisfied. Use the provided tools to assist the user. Remember, you are {agent_name},"
            ' and the booking, update, other other action is not complete until after you have successfully invoked the appropriate tool.'
            ' If the user changes their mind or needs help for other tasks, call the CompleteOrEscalate function to let the primary host assistant take control.'
            ' Do not mention who you are - just act as the proxy for the assistant.'
        )

    # Create HandoffTool instead of StructuredTool
    handoff_tool = HandoffTool(
        name=agent_name,
        description=description,
        func=handoff_function,
        args_schema=HandoffInput,
        target_agent=agent_name,
    )

    return handoff_tool
