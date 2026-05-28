from __future__ import annotations

from typing import Optional

from dotenv import find_dotenv
from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

from .models import ClaudeSettings
from .models import FoxAILLMSettings
from .models import GeminiSettings
from .models import KeycloakSettings
from .models import LangfuseSettings
from .models import Mem0Settings
from .models import MinIOSettings
from .models import OpenAISettings
from .models import PostgresSettings
from .models import QdrantSettings
from .models import RedisSettings
from .models import SecuritySettings
from .models import WhatsAppSettings
from .models import FacebookSettings

load_dotenv(find_dotenv('.env'), override=True)


class Settings(BaseSettings):
    """Settings for the application, loaded from environment variables."""

    # Service URLs
    auth_service_url: str
    index_service_url: str
    query_service_url: str

    # LLM settings
    openai: OpenAISettings
    claude: ClaudeSettings
    gemini: GeminiSettings
    foxaillm: FoxAILLMSettings

    # Storage settings
    minio: MinIOSettings
    qdrant: QdrantSettings
    redis: RedisSettings

    # Personalization memory
    mem0: Mem0Settings

    # Database settings
    postgres: PostgresSettings

    # Security settings
    security: SecuritySettings

    # Keycloak authentication
    keycloak: KeycloakSettings

    # Langfuse observability and metrics
    langfuse: LangfuseSettings = Field(default_factory=LangfuseSettings)

    # WhatsApp Business Cloud API
    whatsapp: Optional[WhatsAppSettings] = Field(default_factory=WhatsAppSettings)

    # Facebook Messenger Platform
    facebook: Optional[FacebookSettings] = Field(default_factory=FacebookSettings)

    class Config:
        env_nested_delimiter = '__'
