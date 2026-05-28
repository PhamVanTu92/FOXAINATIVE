from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class OpenAISettings(BaseModel):
    api_key: str = Field(
        ...,
        description="API key for OpenAI. Example: 'your-openai-api-key'.",
    )
    model_name: str = Field(
        'gpt-4o-mini',
        description="OpenAI Model to use. Example: 'gpt-4'.",
    )
    request_timeout: float = Field(
        120.0,
        description='Time elapsed until openai like server times out the request. Default is 120s. Format is float. ',
    )
    temperature: float = Field(
        0.1,
        description='Temperature for LLM generation. Higher values make output more random.',
    )
    embedding_model: str = Field(
        'text-embedding-3-small',
        description="OpenAI embedding Model to use. Example: 'text-embedding-3-large'.",
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
        3072,
        description='Size of the embedding vector for OpenAI. Default is 3072.',
    )
    max_context_window: int = Field(
        1000000,
        description='Maximum context window size for the model. Default is 1000000 for GPT-4o.',
    )
