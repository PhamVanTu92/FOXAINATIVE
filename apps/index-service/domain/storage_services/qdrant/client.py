from __future__ import annotations

from typing import Any

from infrastructure.embedding import BaseEmbeddingInput
from infrastructure.embedding import EmbeddingService
from infrastructure.storage import BaseStorageInput
from infrastructure.storage import StorageService
from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings
from langchain_qdrant import QdrantVectorStore

logger = get_logger(__name__)


class QdrantClient(BaseModel):
    """Base Qdrant client for handling connections and basic operations"""

    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def embedding_service(self) -> EmbeddingService:
        """Returns the embedding service instance for processing embeddings."""
        return EmbeddingService(settings=self.settings)

    @property
    def storage_service(self) -> StorageService:
        """Returns the storage service instance for processing storage operations."""
        return StorageService(settings=self.settings)

    @property
    def storage_client(self) -> Any:
        """Returns the Qdrant client instance for interacting with the Qdrant database."""
        storage_input = BaseStorageInput(provider_name=self.provider_storage)
        return self.storage_service.process(storage_input)

    @property
    def embedding_client(self) -> Any:
        """Returns the embedding client instance for processing embeddings."""
        embedding_input = BaseEmbeddingInput(
            provider_name=self.provider_embedding,
        )
        return self.embedding_service.process(embedding_input)

    async def initial_vectorstore(self, collection_name: str) -> QdrantVectorStore:
        """
        Connects to a Qdrant collection to create a vector store.

        Args:
            collection_name (str): Name of the collection to connect to.

        Returns:
            QdrantVectorStore: A Qdrant vector store instance connected to the specified collection.
        """
        try:
            logger.info('Initializing vectorstore...')

            # Initialize Qdrant vector store
            vectorstore = QdrantVectorStore(
                client=self.storage_client,
                collection_name=collection_name,
                embedding=self.embedding_client,
            )
            logger.info('Initial vectorstore successfully!')
            return vectorstore
        except Exception as e:
            logger.error(f'Failed to initialize vectorstore: {e}')
            raise

    @property
    def _get_embedding_vector_size(self) -> int:
        """
        Get the vector size based on the embedding provider.

        Returns:
            int: Vector size for the current embedding provider
        """
        if self.provider_embedding.lower() == 'openai':
            return self.settings.openai.embedding_size
        elif self.provider_embedding.lower() == 'claude':
            return self.settings.claude.embedding_size
        elif self.provider_embedding.lower() == 'gemini':
            return self.settings.gemini.embedding_size
        elif self.provider_embedding.lower() == 'foxaillm':
            return self.settings.foxaillm.embedding_size
        else:
            logger.warning(
                f"Unknown embedding provider: {self.provider_embedding}, defaulting to FoxAI LLM size",
            )
            return self.settings.foxaillm.embedding_size
