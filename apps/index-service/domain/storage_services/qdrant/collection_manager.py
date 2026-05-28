from __future__ import annotations

from joint.logging.logger import get_logger
from qdrant_client import models

from .client import QdrantClient

logger = get_logger(__name__)


class QdrantCollectionManager(QdrantClient):
    """Handles collection management operations for Qdrant"""

    async def create_collection(self, collection_name: str) -> bool:
        """
        Creates a new collection with specified configuration and indexes.

        Args:
            collection_name: Name of the collection to create

        Returns:
            bool: True if created successfully, False if already exists

        Raises:
            Exception: If creation fails
        """
        try:
            # Use provided vector_size or get from embedding provider
            vector_size = self._get_embedding_vector_size

            logger.info(
                f"Creating collection '{collection_name}' with vector size {vector_size}",
            )

            # Check if collection already exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name in existing_collections:
                logger.info(f"Collection '{collection_name}' already exists")
                return False

            # Create vector configuration
            vector_config = models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE,
            )

            # Create collection
            result = self.storage_client.create_collection(
                collection_name=collection_name,
                vectors_config=vector_config,
            )

            if result:
                # Create index for document_name field to optimize filtering
                try:
                    self.storage_client.create_payload_index(
                        collection_name=collection_name,
                        field_name='document_name',
                        field_schema=models.PayloadSchemaType.KEYWORD,
                    )
                    logger.info(
                        f"Created payload index for 'document_name' field in collection '{collection_name}'",
                    )
                except Exception as index_error:
                    logger.warning(
                        f"Failed to create payload index for collection '{collection_name}': {str(index_error)}",
                    )
                    # Don't fail the collection creation if index creation fails

                logger.info(
                    f"Collection '{collection_name}' created successfully with indexes",
                )
                return True
            else:
                raise Exception('Collection creation returned False')

        except Exception as e:
            logger.error(
                f"Failed to create collection '{collection_name}': {str(e)}",
            )
            raise

    async def delete_collection(self, collection_name: str) -> bool:
        """
        Deletes a collection.

        Args:
            collection_name: Name of the collection to delete

        Returns:
            bool: True if deleted successfully

        Raises:
            Exception: If deletion fails
        """
        try:
            logger.info(f"Deleting collection '{collection_name}'")

            # Check if collection exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name not in existing_collections:
                logger.warning(
                    f"Collection '{collection_name}' does not exist",
                )
                return False

            # Delete collection
            result = self.storage_client.delete_collection(
                collection_name=collection_name,
            )

            if result:
                logger.info(
                    f"Collection '{collection_name}' deleted successfully",
                )
                return True
            else:
                raise Exception('Collection deletion returned False')

        except Exception as e:
            logger.error(
                f"Failed to delete collection '{collection_name}': {str(e)}",
            )
            raise

    async def delete_document(self, collection_name: str, document_name: str) -> bool:
        """
        Deletes all chunks of a document from Qdrant collection by document_name.

        Args:
            collection_name: Name of the collection
            document_name: Name of the document to delete (all chunks with this name)

        Returns:
            bool: True if deleted successfully, False if no documents found

        Raises:
            Exception: If deletion fails
        """
        try:
            logger.info(
                f"Deleting document '{document_name}' from collection '{collection_name}'",
            )

            # Check if collection exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name not in existing_collections:
                logger.warning(
                    f"Collection '{collection_name}' does not exist",
                )
                return False

            # Create filter to find all chunks with the document_name
            filter_condition = models.Filter(
                must=[
                    models.FieldCondition(
                        key='metadata.document_name',
                        match=models.MatchValue(value=document_name),
                    ),
                ],
            )

            # First, scroll to get all points matching the filter
            scroll_result = self.storage_client.scroll(
                collection_name=collection_name,
                scroll_filter=filter_condition,
                limit=10000,  # Adjust if you expect more chunks per document
                with_payload=True,
                with_vectors=False,
            )

            if not scroll_result[0]:  # No points found
                logger.warning(
                    f"No chunks found for document '{document_name}' in collection '{collection_name}'",
                )
                return False

            # Extract point IDs
            point_ids = [point.id for point in scroll_result[0]]
            logger.info(
                f"Found {len(point_ids)} chunks for document '{document_name}'",
            )

            # Delete the points
            delete_result = self.storage_client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(
                    points=point_ids,
                ),
            )

            if delete_result:
                logger.info(
                    f"Successfully deleted {len(point_ids)} chunks for document '{document_name}' from collection '{collection_name}'",
                )
                return True
            else:
                raise Exception('Document deletion returned False')

        except Exception as e:
            logger.error(
                f"Failed to delete document '{document_name}' from collection '{collection_name}': {str(e)}",
            )
            raise

    async def delete_chunk_by_point_id(self, collection_name: str, qdrant_point_id: str) -> bool:
        """
        Deletes a single chunk from Qdrant collection by qdrant_point_id.

        Args:
            collection_name: Name of the collection
            qdrant_point_id: UUID of the point to delete (from Postgres chunk.qdrant_point_id)

        Returns:
            bool: True if deleted successfully

        Raises:
            Exception: If deletion fails
        """
        try:
            logger.info(
                f"Deleting chunk with point_id '{qdrant_point_id}' from collection '{collection_name}'",
            )

            # Check if collection exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name not in existing_collections:
                logger.warning(
                    f"Collection '{collection_name}' does not exist",
                )
                return False

            # Delete single point by ID
            delete_result = self.storage_client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(
                    points=[qdrant_point_id],
                ),
            )

            if delete_result:
                logger.info(
                    f"Successfully deleted chunk with point_id '{qdrant_point_id}' from collection '{collection_name}'",
                )
                return True
            else:
                raise Exception('Chunk deletion returned False')

        except Exception as e:
            logger.error(
                f"Failed to delete chunk with point_id '{qdrant_point_id}' from collection '{collection_name}': {str(e)}",
            )
            raise

    async def update_chunk_metadata(self, collection_name: str, qdrant_point_id: str, metadata: dict) -> bool:
        """
        Updates metadata (payload) of a chunk in Qdrant without re-embedding.
        Useful for toggling is_enabled flag.

        Args:
            collection_name: Name of the collection
            qdrant_point_id: UUID of the point to update
            metadata: Dictionary of metadata fields to update (will merge with existing)

        Returns:
            bool: True if updated successfully

        Raises:
            Exception: If update fails
        """
        try:
            logger.info(
                f"Updating metadata for chunk with point_id '{qdrant_point_id}' in collection '{collection_name}'",
            )

            # Check if collection exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name not in existing_collections:
                logger.warning(
                    f"Collection '{collection_name}' does not exist",
                )
                return False

            # Wrap metadata in 'metadata' key to match Qdrant structure
            # Qdrant structure: {"metadata": {...}, "page_content": "..."}
            # We need to update ONLY the metadata part
            payload_update = {
                'metadata': metadata,
            }

            # Update payload (metadata) for the point
            # set_payload merges with existing payload
            self.storage_client.set_payload(
                collection_name=collection_name,
                payload=payload_update,
                points=[qdrant_point_id],
            )

            logger.info(
                f"Successfully updated metadata for chunk with point_id '{qdrant_point_id}'",
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to update metadata for chunk with point_id '{qdrant_point_id}': {str(e)}",
            )
            raise

    async def upsert_chunk(
        self,
        collection_name: str,
        chunk_content: str,
        qdrant_point_id: str,
        metadata: dict,
    ) -> bool:
        """
        Inserts or updates a chunk in Qdrant with embedding.
        Used for creating new chunks or updating chunk content (requires re-embedding).

        Args:
            collection_name: Name of the collection
            chunk_content: Text content to embed
            qdrant_point_id: UUID for the point (from Postgres)
            metadata: Full metadata dictionary for the chunk

        Returns:
            bool: True if upserted successfully

        Raises:
            Exception: If upsert fails
        """
        try:
            logger.info(
                f"Upserting chunk with point_id '{qdrant_point_id}' to collection '{collection_name}'",
            )

            # Check if collection exists
            collections = self.storage_client.get_collections().collections
            existing_collections = [
                collection.name for collection in collections
            ]

            if collection_name not in existing_collections:
                logger.warning(
                    f"Collection '{collection_name}' does not exist",
                )
                return False

            # Generate embedding for the chunk content
            embedding_vector = await self.embedding_client.aembed_query(chunk_content)

            # Create point
            point = models.PointStruct(
                id=qdrant_point_id,
                vector=embedding_vector,
                payload={'metadata': metadata, 'page_content': chunk_content},
            )

            # Upsert point (insert or update)
            self.storage_client.upsert(
                collection_name=collection_name,
                points=[point],
            )

            logger.info(
                f"Successfully upserted chunk with point_id '{qdrant_point_id}' to collection '{collection_name}'",
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to upsert chunk with point_id '{qdrant_point_id}': {str(e)}",
            )
            raise
