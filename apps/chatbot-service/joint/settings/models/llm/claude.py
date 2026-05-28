from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class ClaudeSettings(BaseModel):
    """Claude API settings."""
    api_key: str = Field(
        ...,
        description="API key for Anthropic Claude. Example: 'your-anthropic-api-key'.",
    )
    model_name: str = Field(
        'claude-3-7-sonnet-20250219',
        description="Claude Model to use. Example: 'claude-3-7-sonnet-20250219'.",
    )
    request_timeout: float = Field(
        120.0,
        description='Time elapsed until claude like server times out the request. Default is 120s. Format is float. ',
    )
    temperature: float = Field(
        0.1,
        description='Temperature for LLM generation. Higher values make output more random.',
    )
    embedding_model: str = Field(
        'voyage-3-large',
        description="Claude embedding Model to use. Example: 'voyage-3-large'.",
    )
    max_retries: str = Field(
        3,
        description='Maximum number of retries for failed requests.',
    )
    streaming: bool = Field(
        False,
        description='Whether to stream responses from the model.',
    )
    max_output_tokens: int = Field(
        1024,
        description='Maximum number of tokens to generate in the output.',
    )
    embedding_size: int = Field(
        2048,
        description='Size of the embedding vector for Claude. Default is 2048.',
    )
    max_context_window: int = Field(
        200000,
        description='Maximum context window size for the model. Default is 200000 for Claude 3.7 Sonnet.',
    )
