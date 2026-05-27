from __future__ import annotations

from typing import Optional
from uuid import UUID

from domain.db_service.collection_services import DeletingCollectionInput
from domain.db_service.collection_services import DeletingCollectionService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings import Settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class CollectionDeletionInput(BaseModel):
    """Input model for deleting a collection"""
    collection_id: UUID


class CollectionDeletionOutput(BaseModel):
    """Output model for successful collection deletion"""
    message: str
    collection_id: str


class CollectionDeletionService(BaseService):
    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def qdrant_service(self) -> QdrantService:
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    @property
    def deleting_collection_service(self) -> DeletingCollectionService:
        return DeletingCollectionService(settings=self.settings.postgres)

    async def process(
        self,
        inputs: CollectionDeletionInput,
        db: Optional[Session] = None,
    ) -> CollectionDeletionOutput:
        """
        Deletes a collection from both PostgreSQL and Qdrant.

        Args:
            inputs: CollectionDeletionInput containing collection_id
            db: Optional database session (if not provided, service creates its own)

        Returns:
            CollectionDeletionOutput with success message

        Raises:
            Exception: If collection deletion fails in either system
        """
        try:
            logger.info(
                f'Starting collection deletion for ID: {inputs.collection_id}',
            )

            # Step 1: Delete collection from PostgreSQL first
            postgres_input = DeletingCollectionInput(
                collection_id=inputs.collection_id,
            )

            postgres_result = await self.deleting_collection_service.process(
                postgres_input,
                db=db,
            )

            if not postgres_result.status:
                raise Exception(
                    f'Failed to delete collection from PostgreSQL: {postgres_result.message}',
                )

            collection_name = postgres_result.collection_name
            logger.info(
                f"Collection '{collection_name}' deleted from PostgreSQL successfully",
            )

            # Step 2: Delete collection from Qdrant using the collection_name

            qdrant_deleted = await self.qdrant_service.delete_collection(
                collection_name=collection_name,
            )

            if qdrant_deleted:
                logger.info(
                    f"Collection '{collection_name}' deleted from Qdrant successfully",
                )
            else:
                logger.warning(
                    f"Collection '{collection_name}' was not found in Qdrant (may not exist)",
                )

            return CollectionDeletionOutput(
                message=f"Collection '{collection_name}' deleted successfully",
                collection_id=str(inputs.collection_id),
            )

        except Exception as e:
            logger.error(
                f"Failed to delete collection ID '{inputs.collection_id}': {str(e)}",
            )
            raise Exception(f'Collection deletion failed: {str(e)}')
