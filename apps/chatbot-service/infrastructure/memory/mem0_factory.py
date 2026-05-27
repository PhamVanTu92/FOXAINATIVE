"""Singleton factory for Mem0 AsyncMemory instance."""
from __future__ import annotations

from typing import Optional

from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_LLM_PROVIDER
from joint.settings import Settings
from mem0 import AsyncMemory

logger = get_logger(__name__)

# Global singleton
_ASYNC_MEMORY: Optional[AsyncMemory] = None


class Mem0Factory:
    """Factory for creating and managing a singleton Mem0 AsyncMemory instance.

    Reuses existing Qdrant and configured LLM/embedding infrastructure from
    application settings.
    Follows the same singleton pattern as CheckpointerFactory.
    """

    @classmethod
    def _build_llm_config(cls, settings: Settings) -> dict:
        """Build Mem0 LLM config from the app default provider."""
        provider = DEFAULT_LLM_PROVIDER.lower()

        if provider == 'openai':
            return {
                'provider': 'openai',
                'config': {
                    'model': settings.openai.model_name,
                    'temperature': settings.openai.temperature,
                    'max_tokens': settings.openai.max_output_tokens,
                    'api_key': settings.openai.api_key,
                },
            }

        if provider == 'gemini':
            return {
                'provider': 'gemini',
                'config': {
                    'model': settings.gemini.model_name,
                    'temperature': settings.gemini.temperature,
                    'max_tokens': settings.gemini.max_output_tokens,
                    'api_key': settings.gemini.api_key,
                },
            }

        if provider == 'claude':
            return {
                'provider': 'anthropic',
                'config': {
                    'model': settings.claude.model_name,
                    'temperature': settings.claude.temperature,
                    'max_tokens': settings.claude.max_output_tokens,
                    'api_key': settings.claude.api_key,
                },
            }

        if provider == 'foxaillm':
            return {
                'provider': 'openai',
                'config': {
                    'model': settings.foxaillm.model_name,
                    'temperature': settings.foxaillm.temperature,
                    'max_tokens': settings.foxaillm.max_output_tokens,
                    'api_key': settings.foxaillm.api_key,
                    'openai_base_url': settings.foxaillm.base_url,
                },
            }

        raise ValueError(
            f'Unsupported Mem0 LLM provider from defaults: {DEFAULT_LLM_PROVIDER}',
        )

    @classmethod
    def _build_embedder_config(cls, settings: Settings) -> dict:
        """Build Mem0 embedder config from the app default provider."""
        provider = DEFAULT_EMBEDDING_PROVIDER.lower()

        if provider == 'openai':
            return {
                'provider': 'openai',
                'config': {
                    'model': settings.openai.embedding_model,
                    'api_key': settings.openai.api_key,
                    'embedding_dims': settings.openai.embedding_size,
                },
            }

        if provider == 'gemini':
            return {
                'provider': 'gemini',
                'config': {
                    'model': settings.gemini.embedding_model,
                    'api_key': settings.gemini.api_key,
                    'embedding_dims': settings.gemini.embedding_size,
                },
            }

        if provider == 'foxaillm':
            return {
                'provider': 'openai',
                'config': {
                    'model': settings.foxaillm.embedding_model,
                    'api_key': settings.foxaillm.api_key,
                    'embedding_dims': settings.foxaillm.embedding_size,
                    'openai_base_url': settings.foxaillm.base_url,
                },
            }

        raise ValueError(
            'Mem0 does not support the configured embedding provider '
            f'from defaults: {DEFAULT_EMBEDDING_PROVIDER}',
        )

    @classmethod
    def _build_config(cls, settings: Settings) -> dict:
        """Build Mem0 configuration from application settings.

        Maps existing Qdrant and configured provider settings to Mem0 config
        format.
        No hardcoded values — everything comes from Settings.

        Args:
            settings: Application settings instance.

        Returns:
            Complete Mem0 configuration dictionary.
        """
        qdrant_url = settings.qdrant.host  # e.g. "http://qdrant:6333"
        # Parse host and port from Qdrant URL
        qdrant_host = qdrant_url.replace(
            'http://', '',
        ).replace('https://', '').split(':')[0]
        try:
            qdrant_port = int(qdrant_url.split(':')[-1])
        except (ValueError, IndexError):
            qdrant_port = 6333

        llm_config = cls._build_llm_config(settings)
        embedder_config = cls._build_embedder_config(settings)

        return {
            'vector_store': {
                'provider': 'qdrant',
                'config': {
                    'collection_name': settings.mem0.collection_name,
                    'host': qdrant_host,
                    'port': qdrant_port,
                    'embedding_model_dims': embedder_config['config']['embedding_dims'],
                },
            },
            'llm': llm_config,
            'embedder': embedder_config,
            'version': 'v1.1',
        }

    @classmethod
    async def get_instance(cls, settings: Settings) -> AsyncMemory:
        """Get or create the singleton AsyncMemory instance.

        Args:
            settings: Application settings instance.

        Returns:
            Configured AsyncMemory instance ready for use.

        Raises:
            Exception: If Mem0 initialization fails.
        """
        global _ASYNC_MEMORY

        if _ASYNC_MEMORY is not None:
            return _ASYNC_MEMORY

        config = cls._build_config(settings)
        _ASYNC_MEMORY = await AsyncMemory.from_config(config)

        logger.info(
            'Mem0 AsyncMemory initialized',
            extra={
                'collection': settings.mem0.collection_name,
                'qdrant_host': settings.qdrant.host,
            },
        )
        return _ASYNC_MEMORY

    @classmethod
    async def close(cls) -> None:
        """Release the singleton instance for clean shutdown."""
        global _ASYNC_MEMORY

        if _ASYNC_MEMORY is not None:
            _ASYNC_MEMORY = None
            logger.info('Mem0 AsyncMemory instance released')

    @classmethod
    def is_initialized(cls) -> bool:
        """Check whether the singleton has been created."""
        return _ASYNC_MEMORY is not None
