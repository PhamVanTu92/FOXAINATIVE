from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class FoxAILLMSettings(BaseModel):
    """FoxAI LLM API settings."""
    api_key: str = Field(
        ...,
        description="API key for FoxAI LLM. Example: 'your-foxaillm-api-key'.",
    )
    base_url: str = Field(
        ...,
        description="Base URL for FoxAI LLM API. Example: 'https://api.foxai.com/v1'.",
    )
    model_name: str = Field(
        'foxai-chat-v1',
        description="FoxAI LLM Model to use. Example: 'foxai-chat-v1'.",
    )
    request_timeout: float = Field(
        120.0,
        description='Time elapsed until FoxAI LLM server times out the request. Default is 120s. Format is float.',
    )
    temperature: float = Field(
        0.1,
        description='Temperature for LLM generation. Higher values make output more random.',
    )
    embedding_model: str = Field(
        'foxai-embedding-v1',
        description="FoxAI LLM embedding Model to use. Example: 'foxai-embedding-v1'.",
    )
    max_retries: int = Field(
        3,
        description='Maximum number of retries for failed requests.',
    )
    streaming: bool = Field(
        False,
        description='Whether to stream responses from the model.',
    )
    max_output_tokens: int = Field(
        2048,
        description='Maximum number of tokens to generate in the output.',
    )
    embedding_size: int = Field(
        3072,
        description='Size of the embedding vector for FoxAI LLM. Default is 3072.',
    )
    max_context_window: int = Field(
        20000,
        description='Maximum context window size for the model. Default is 20000 for Qwen models.',
    )
