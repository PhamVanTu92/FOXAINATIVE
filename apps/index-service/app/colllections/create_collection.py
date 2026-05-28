from __future__ import annotations

from typing import Optional
from uuid import UUID

from domain.db_service.collection_services import CreatingCollectionInput
from domain.db_service.collection_services import CreatingCollectionService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.settings import Settings
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER

logger = get_logger(__name__)


class CreateCollectionRequest(BaseModel):
    """Request model for creating a collection (API input from request body)"""
    collection_name: str
    description: str = ''
    collection_style: Optional[str] = None
    creativity_level: Optional[float] = None
    provider_embedding: str = DEFAULT_EMBEDDING_PROVIDER
    provider_storage: str = DEFAULT_STORAGE_PROVIDER


class CollectionCreationInput(BaseModel):
    """Input model for creating a collection"""
    collection_name: str
    user_id: UUID
    description: str
    collection_style: Optional[str] = None
    creativity_level: Optional[float] = None
    provider_embedding: str = DEFAULT_EMBEDDING_PROVIDER
    provider_storage: str = DEFAULT_STORAGE_PROVIDER


class CollectionCreationOutput(BaseModel):
    """Output model for successful collection creation"""
    message: str
    collection_id: Optional[str] = None
    collection_name: str


class CollectionCreationService(BaseService):
    settings: Settings
    provider_storage: str
    provider_embedding: str

    @property
    def Creating_collection_service(self) -> CreatingCollectionService:
        return CreatingCollectionService(
            settings=self.settings.postgres,
        )

    @property
    def qdrant_service(self) -> QdrantService:
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    async def process(self, inputs: CollectionCreationInput, db_session=None) -> CollectionCreationOutput:
        """
        Creates a new collection in both Qdrant and PostgreSQL.

        Args:
            inputs: CollectionCreationInput containing collection_name, user_id, description

        Returns:
            CollectionCreationOutput with success message

        Raises:
            Exception: If collection creation fails in either system
        """
        try:
            logger.info(
                f"Starting collection creation for: {inputs.collection_name}",
            )

            # Step 1: Save collection to PostgreSQL first
            postgres_input = CreatingCollectionInput(
                collection_name=inputs.collection_name,
                description=inputs.description,
                user_id=inputs.user_id,
                collection_style=inputs.collection_style,
                creativity_level=inputs.creativity_level,
            )

            postgres_result = await self.Creating_collection_service.process(postgres_input, db_session)

            if not postgres_result.status:
                error_msg = f"Failed to save collection to PostgreSQL: {postgres_result.message}"
                logger.error(error_msg)
                raise Exception(error_msg)

            # If collection already exists in PostgreSQL, return early
            if postgres_result.already_exists:
                logger.info(
                    f"Collection '{inputs.collection_name}' already exists",
                )
                return CollectionCreationOutput(
                    message=postgres_result.message,
                    collection_id=str(
                        postgres_result.collection_id,
                    ) if postgres_result.collection_id else None,
                    collection_name=inputs.collection_name,
                )

            logger.info(
                f"Collection '{inputs.collection_name}' saved to PostgreSQL successfully",
            )

            # Step 2: Create collection in Qdrant

            qdrant_created = await self.qdrant_service.create_collection(
                collection_name=inputs.collection_name,
            )

            if qdrant_created:
                logger.info(
                    f"Collection '{inputs.collection_name}' created in Qdrant successfully",
                )
            else:
                logger.warning(
                    f"Failed to create collection '{inputs.collection_name}' in Qdrant",
                )
                raise Exception('Failed to create collection in Qdrant')

            return CollectionCreationOutput(
                message=f"Collection '{inputs.collection_name}' created successfully",
                collection_id=str(
                    postgres_result.collection_id,
                ) if postgres_result.collection_id else None,
                collection_name=inputs.collection_name,
            )

        except Exception as e:
            logger.error(
                f"Failed to create collection '{inputs.collection_name}': {str(e)}",
            )
            raise Exception(f"Collection creation failed: {str(e)}")
