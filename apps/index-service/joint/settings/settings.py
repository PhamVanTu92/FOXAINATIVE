from __future__ import annotations

from dotenv import find_dotenv
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

from .models import ChunkerSettings
from .models import ClaudeSettings
from .models import ConverterSettings
from .models import FoxAILLMSettings
from .models import GeminiSettings
from .models import KeycloakSettings
from .models import MinIOSettings
from .models import OpenAISettings
from .models import PostgresSettings
from .models import QdrantSettings
from .models import RedisSettings
from .models import SecuritySettings

load_dotenv(find_dotenv('.env'), override=True)


class Settings(BaseSettings):
    """Settings for the application, loaded from environment variables."""

    # LLM settings
    openai: OpenAISettings
    claude: ClaudeSettings
    gemini: GeminiSettings
    foxaillm: FoxAILLMSettings

    # Storage settings
    minio: MinIOSettings
    qdrant: QdrantSettings
    redis: RedisSettings

    # Docling settings
    converter: ConverterSettings
    chunker: ChunkerSettings

    # Database settings
    postgres: PostgresSettings

    # Security settings
    security: SecuritySettings

    # Keycloak authentication
    keycloak: KeycloakSettings

    class Config:
        env_nested_delimiter = '__'
