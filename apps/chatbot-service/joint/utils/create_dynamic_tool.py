from __future__ import annotations

from typing import Callable
from typing import Type

from langchain_core.tools import tool
from pydantic import BaseModel


def create_dynamic_tool(
    tool_name: str,
    model_schema: Type[BaseModel],
    tool_function: Callable,
    description: str | None = None,
    return_direct: bool = True,
):
    """
    Create a dynamic tool for a single model

    Args:
        tool_name: Name of the tool
        model_schema: Pydantic model to use as schema
        tool_function: Function to execute when tool is called
        description: Description of the tool (optional)
        return_direct: Whether to return result directly

    Returns:
        LangChain tool with dynamic schema
    """
    # Set default description if not provided
    if description is None:
        description = f"Tool for {tool_name} with dynamic schema"

    # Create the tool with dynamic schema
    dynamic_tool = tool(
        tool_name,
        args_schema=model_schema,
        description=description,
        return_direct=return_direct,
    )(tool_function)

    return dynamic_tool
