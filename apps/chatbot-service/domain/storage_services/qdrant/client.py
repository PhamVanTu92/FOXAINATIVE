from __future__ import annotations

from typing import Any
from typing import Dict

from infrastructure.embedding import BaseEmbeddingInput
from infrastructure.embedding import EmbeddingService
from infrastructure.storage import BaseStorageInput
from infrastructure.storage import StorageService
from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings
from langchain_qdrant import QdrantVectorStore

logger = get_logger(__name__)

# Module-level vectorstore cache
_vectorstore_cache: Dict[str, QdrantVectorStore] = {}


class QdrantClient(BaseModel):
    """Qdrant client with vectorstore caching.

    Uses module-level cache to prevent repeated vectorstore initialization.
    Underlying storage and embedding clients are also singletons.
    """

    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def embedding_service(self) -> EmbeddingService:
        """Get embedding service instance."""
        return EmbeddingService(settings=self.settings)

    @property
    def storage_service(self) -> StorageService:
        """Get storage service instance."""
        return StorageService(settings=self.settings)

    @property
    def storage_client(self) -> Any:
        """Get Qdrant client (singleton from provider)."""
        storage_input = BaseStorageInput(provider_name=self.provider_storage)
        return self.storage_service.process(storage_input)

    @property
    def embedding_client(self) -> Any:
        """Get embedding client (singleton from provider)."""
        embedding_input = BaseEmbeddingInput(
            provider_name=self.provider_embedding,
        )
        return self.embedding_service.process(embedding_input)

    def get_vectorstore(self, collection_name: str) -> QdrantVectorStore:
        """Get cached vectorstore for collection.

        Args:
            collection_name: Qdrant collection name.

        Returns:
            Cached QdrantVectorStore instance.
        """
        cache_key = f"{collection_name}:{self.provider_embedding}"

        if cache_key not in _vectorstore_cache:
            logger.info(f"Initializing vectorstore: {cache_key}")
            _vectorstore_cache[cache_key] = QdrantVectorStore(
                client=self.storage_client,
                collection_name=collection_name,
                embedding=self.embedding_client,
            )
            logger.info(f"Vectorstore initialized: {cache_key}")

        return _vectorstore_cache[cache_key]

    async def initial_vectorstore(self, collection_name: str) -> QdrantVectorStore:
        """Get vectorstore (async wrapper for backward compatibility).

        Args:
            collection_name: Qdrant collection name.

        Returns:
            Cached QdrantVectorStore instance.
        """
        return self.get_vectorstore(collection_name)

    @property
    def _get_embedding_vector_size(self) -> int:
        """Get vector size based on embedding provider."""
        provider = self.provider_embedding.lower()
        size_map = {
            'openai': self.settings.openai.embedding_size,
            'claude': self.settings.claude.embedding_size,
            'gemini': self.settings.gemini.embedding_size,
            'foxaillm': self.settings.foxaillm.embedding_size,
        }
        return size_map.get(provider, self.settings.foxaillm.embedding_size)


def reset_vectorstore_cache() -> None:
    """Reset vectorstore cache for cleanup."""
    global _vectorstore_cache
    if _vectorstore_cache:
        logger.info(f"Resetting {len(_vectorstore_cache)} vectorstore(s)")
        _vectorstore_cache.clear()
