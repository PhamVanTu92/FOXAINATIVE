from __future__ import annotations

from typing import Any
from typing import Dict
from typing import List

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings

from .qdrant.client import QdrantClient
from .qdrant.collection_manager import QdrantCollectionManager
from .qdrant.seeder import DocumentType
from .qdrant.seeder import QdrantSeeder

logger = get_logger(__name__)


class QdrantService(BaseModel):
    """
    Main Qdrant service that orchestrates all Qdrant operations.
    This is a facade that delegates to specialized components.
    """

    settings: Settings
    provider_storage: str
    provider_embedding: str

    # Private attributes for caching
    _client = None
    _collection_manager = None
    _seeder = None

    @property
    def client(self) -> QdrantClient:
        """Lazy loading client with caching"""
        if self._client is None:
            self._client = QdrantClient(
                settings=self.settings,
                provider_storage=self.provider_storage,
                provider_embedding=self.provider_embedding,
            )
        return self._client

    @property
    def collection_manager(self) -> QdrantCollectionManager:
        """Lazy loading collection manager with caching"""
        if self._collection_manager is None:
            self._collection_manager = QdrantCollectionManager(
                settings=self.settings,
                provider_storage=self.provider_storage,
                provider_embedding=self.provider_embedding,
            )
        return self._collection_manager

    @property
    def seeder(self) -> QdrantSeeder:
        """Lazy loading seeder with caching"""
        if self._seeder is None:
            self._seeder = QdrantSeeder(
                settings=self.settings,
                provider_storage=self.provider_storage,
                provider_embedding=self.provider_embedding,
            )
        return self._seeder

    # Delegate client operations
    async def initial_vectorstore(self, collection_name: str):
        """Initialize vector store connection."""
        return await self.client.initial_vectorstore(collection_name)

    # Delegate collection management operations
    async def create_collection(self, collection_name: str) -> bool:
        """Create a new collection."""
        return await self.collection_manager.create_collection(collection_name)

    async def delete_collection(self, collection_name: str) -> bool:
        """Delete a collection."""
        return await self.collection_manager.delete_collection(collection_name)

    async def delete_document(self, collection_name: str, document_name: str) -> bool:
        """Delete all chunks of a document from collection."""
        return await self.collection_manager.delete_document(collection_name, document_name)

    # Delegate chunk management operations
    async def delete_chunk_by_point_id(self, collection_name: str, qdrant_point_id: str) -> bool:
        """Delete a single chunk by qdrant_point_id."""
        return await self.collection_manager.delete_chunk_by_point_id(collection_name, qdrant_point_id)

    async def update_chunk_metadata(self, collection_name: str, qdrant_point_id: str, metadata: dict) -> bool:
        """Update chunk metadata (e.g., toggle is_enabled)."""
        return await self.collection_manager.update_chunk_metadata(collection_name, qdrant_point_id, metadata)

    async def upsert_chunk(
        self,
        collection_name: str,
        chunk_content: str,
        qdrant_point_id: str,
        metadata: dict,
    ) -> bool:
        """Insert or update a chunk with embedding."""
        return await self.collection_manager.upsert_chunk(collection_name, chunk_content, qdrant_point_id, metadata)

    # Delegate seeding operations
    async def seed(self, data: List[Any], collection_name: str, document_type: DocumentType = DocumentType.STRUCTURED, metadata: Dict[str, Any] | None = None) -> None:
        """Seed collection with documents of specified type."""
        await self.seeder.seed(data, collection_name, document_type, metadata)

    async def seed_excel(self, chunks: List[Dict[str, Any]], collection_name: str, metadata: Dict[str, Any] | None = None) -> None:
        """Seed collection with Excel documents (QA format with chunks)."""
        await self.seeder.seed_excel(chunks, collection_name, metadata)

    async def seed_sentence(self, data: List[Any], collection_name: str, metadata: Dict[str, Any] | None = None) -> None:
        """Seed collection with sentence-based documents."""
        await self.seeder.seed_sentence(data, collection_name, metadata)

    # Properties for backward compatibility
    @property
    def embedding_service(self):
        """Get embedding service from client."""
        return self.client.embedding_service

    @property
    def storage_service(self):
        """Get storage service from client."""
        return self.client.storage_service

    @property
    def storage_client(self):
        """Get storage client from client."""
        return self.client.storage_client

    @property
    def embedding_client(self):
        """Get embedding client from client."""
        return self.client.embedding_client

    @property
    def _get_embedding_vector_size(self) -> int:
        """Get embedding vector size from client."""
        return self.client._get_embedding_vector_size
