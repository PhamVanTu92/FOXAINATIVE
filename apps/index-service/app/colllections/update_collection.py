from __future__ import annotations

from typing import Optional
from uuid import UUID

from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.postgres.database import CollectionController
from joint.postgres.models import Collection as CollectionModel
from joint.settings import Settings
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class UpdateCollectionRequest(BaseModel):
    """Request body for updating a collection.

    All fields are optional — only the ones provided are changed. Renaming
    ``collection_name`` also migrates the underlying Qdrant collection.
    """
    collection_name: Optional[str] = None
    description: Optional[str] = None
    collection_style: Optional[str] = None


class CollectionUpdateInput(BaseModel):
    """Internal input for CollectionUpdateService."""
    collection_id: UUID
    user_id: UUID
    collection_name: Optional[str] = None
    description: Optional[str] = None
    collection_style: Optional[str] = None


class CollectionUpdateOutput(BaseModel):
    """Output model for a successful collection update."""
    message: str
    collection_id: str
    collection_name: str
    name_changed: bool = False
    warning: Optional[str] = None


class CollectionUpdateService(BaseService):
    """Update a collection's metadata (and rename it when collection_name changes).

    Rename strategy keeps data safe: clone the Qdrant collection under the new
    name, commit Postgres, then drop the old Qdrant collection. A failure at any
    step leaves the original collection intact.
    """

    settings: Settings
    provider_storage: str = DEFAULT_STORAGE_PROVIDER
    provider_embedding: str = DEFAULT_EMBEDDING_PROVIDER

    @property
    def qdrant_service(self) -> QdrantService:
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    @property
    def collection_controller(self) -> CollectionController:
        return CollectionController()

    async def process(
        self, inputs: CollectionUpdateInput, db: Session,
    ) -> CollectionUpdateOutput:
        """Apply the requested changes, migrating Qdrant when renaming.

        Args:
            inputs: Fields to update (only non-None ones are applied).
            db: Active database session.

        Returns:
            CollectionUpdateOutput describing the result.

        Raises:
            ValueError: Collection not found or the new name already exists.
            PermissionError: Caller does not own the collection.
        """
        controller = self.collection_controller

        collection = controller.get_by_id(db, inputs.collection_id)
        if collection is None:
            raise ValueError(f"Collection '{inputs.collection_id}' not found")
        if collection.user_id != inputs.user_id:
            raise PermissionError('You do not own this collection')

        old_name = collection.collection_name
        new_name = inputs.collection_name
        name_changed = bool(new_name) and new_name != old_name
        warning: Optional[str] = None

        if name_changed:
            # Reject a name already used by another of this user's collections.
            duplicate = db.execute(
                select(CollectionModel).where(
                    CollectionModel.collection_name == new_name,
                    CollectionModel.user_id == inputs.user_id,
                    CollectionModel.id != collection.id,
                ),
            ).scalar_one_or_none()
            if duplicate is not None:
                raise ValueError(
                    f"Collection name '{new_name}' already exists",
                )

            # Clone vectors into the new name first (old stays intact).
            await self.qdrant_service.clone_collection(old_name, new_name)
            warning = (
                'Collection renamed. Chatbots already bound to the old name '
                'must re-select this collection to keep answering.'
            )

        # Apply Postgres changes (controller.update commits the transaction).
        if name_changed:
            collection.collection_name = new_name
        if inputs.description is not None:
            collection.description = inputs.description
        if inputs.collection_style is not None:
            collection.collection_style = inputs.collection_style

        try:
            controller.update(db, collection)
        except Exception:
            # Roll back the freshly-cloned Qdrant collection so we don't leak it.
            if name_changed:
                try:
                    await self.qdrant_service.delete_collection(new_name)
                except Exception as cleanup_err:
                    logger.warning(
                        f"Failed to clean up cloned collection '{new_name}': "
                        f'{cleanup_err}',
                    )
            raise

        # Postgres is committed — safe to drop the old Qdrant collection.
        if name_changed:
            try:
                await self.qdrant_service.delete_collection(old_name)
            except Exception as drop_err:
                logger.warning(
                    f"Renamed to '{new_name}' but failed to drop old Qdrant "
                    f"collection '{old_name}': {drop_err}",
                )

        logger.info(
            f"Collection '{inputs.collection_id}' updated "
            f"(name_changed={name_changed})",
        )
        return CollectionUpdateOutput(
            message='Collection updated successfully',
            collection_id=str(collection.id),
            collection_name=collection.collection_name,
            name_changed=name_changed,
            warning=warning,
        )
