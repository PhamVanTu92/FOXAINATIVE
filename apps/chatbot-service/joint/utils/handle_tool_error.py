from __future__ import annotations

from typing import Union

from joint.logging import get_logger
from langchain_core.messages import AIMessage
from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableLambda
from langgraph.prebuilt import ToolNode
from langgraph.types import Command

logger = get_logger(__name__)


def handle_tool_error(state) -> dict:
    error = state.get('error')
    tool_calls = state['messages'][-1].tool_calls
    return {
        'messages': [
            ToolMessage(
                content=f"Error: {repr(error)}\n please fix your mistakes.",
                tool_call_id=tc['id'],
            )
            for tc in tool_calls
        ],
    }


def handle_handoff_tools(state: dict) -> Union[Command, dict]:
    """
    Post-process ToolNode output to handle handoff tools.

    If a handoff tool was called, convert the ToolMessage to a Command.
    """
    messages = state.get('messages', [])

    if not messages:
        return state

    # Get the last AIMessage with tool_calls
    last_ai_message = None
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and hasattr(msg, 'tool_calls') and msg.tool_calls:
            last_ai_message = msg
            break

    if not last_ai_message:
        return state

    # Check if any tool call is a handoff tool
    for tool_call in last_ai_message.tool_calls:
        tool_name = tool_call.get('name') if isinstance(
            tool_call, dict,
        ) else getattr(tool_call, 'name', None)
        tool_call_id = tool_call.get('id') if isinstance(
            tool_call, dict,
        ) else getattr(tool_call, 'id', None)

        # Find corresponding ToolMessage in recent messages
        for msg in reversed(messages):
            if isinstance(msg, ToolMessage) and msg.tool_call_id == tool_call_id:
                # Create Command for handoff
                return Command(
                    goto=tool_name,
                    update={
                        'messages': [msg],
                        'dialog_state': tool_name,
                    },
                )

    # No handoff tool found, return state as-is
    return state


def create_tool_node_with_fallback(tools: list):
    """
    Create ToolNode with fallback error handling and handoff tool processing.

    For handoff tools, the flow is:
    1. ToolNode invokes the tool and creates ToolMessage
    2. handle_handoff_tools converts ToolMessage to Command for routing
    """
    # Separate handoff tools from regular tools
    handoff_tools = [t for t in tools if getattr(t, 'is_handoff', False)]

    if handoff_tools:
        # Chain: ToolNode -> fallback -> handoff handler
        tool_node = ToolNode(tools).with_fallbacks(
            [RunnableLambda(handle_tool_error)], exception_key='error',
        )

        # Wrap the chain in a function that processes handoffs
        def process_with_handoff(state):
            # Invoke tool node
            result = tool_node.invoke(state)

            # Merge result with original state to have full message history
            merged_state = dict(state)
            if isinstance(result, dict) and 'messages' in result:
                # Append new messages to existing messages
                merged_state['messages'] = state.get(
                    'messages', [],
                ) + result['messages']

            # Now process for handoffs with full state
            return handle_handoff_tools(merged_state)

        return RunnableLambda(process_with_handoff)
    else:
        # Regular tools only
        return ToolNode(tools).with_fallbacks(
            [RunnableLambda(handle_tool_error)], exception_key='error',
        )
