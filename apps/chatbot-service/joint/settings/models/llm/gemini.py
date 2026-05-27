from __future__ import annotations

from joint.base import BaseModel
from pydantic import Field


class GeminiSettings(BaseModel):
    """Gemini API settings."""
    api_key: str = Field(
        ...,
        description="API key for Gemini. Example: 'your-gemini-api-key'.",
    )
    model_name: str = Field(
        'gemini-2.5-flash',
        description="Gemini Model to use. Example: 'gemini-2.5-flash'.",
    )
    model_name_vision: str = Field(
        'models/gemini-2.5-flash',
        description="Gemini Vision Model to use. Example: 'models/gemini-2.5-flash'.",
    )
    request_timeout: float = Field(
        120.0,
        description='Time elapsed until gemini like server times out the request. Default is 120s. Format is float. ',
    )
    temperature: float = Field(
        0.1,
        description='Temperature for LLM generation. Higher values make output more random.',
    )
    embedding_model: str = Field(
        'gemini-embedding-exp-03-07',
        description="Gemini embedding Model to use. Example: 'gemini-embedding-exp-03-07'.",
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
        description='Size of the embedding vector for Gemini. Default is 3072.',
    )
    max_context_window: int = Field(
        1000000,
        description='Maximum context window size for the model. Default is 1000000 for Gemini 2.5 Flash.',
    )
    voice_model: str = Field(
        'gemini-2.5-flash-preview-native-audio-dialog',
        description='Gemini model for voice/audio conversations (realtime — not used by simple TTS).',
    )
    tts_model: str = Field(
        'gemini-2.5-flash-preview-tts',
        description='Gemini one-shot TTS model. Generates PCM audio (24kHz, 16-bit, mono).',
    )
    tts_voice_name: str = Field(
        'Kore',
        description='Default prebuilt voice for TTS. Options: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede.',
    )
