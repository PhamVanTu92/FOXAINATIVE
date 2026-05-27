from __future__ import annotations

import uuid
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import CollectionController
from joint.postgres.database.schemas import Collection
from joint.settings.settings import PostgresSettings

logger = get_logger(__name__)


class CreatingCollectionInput(BaseModel):
    """Input model for CreatingCollectionService"""
    collection_name: str
    description: str
    user_id: uuid.UUID
    collection_style: str | None = None
    creativity_level: float | None = None


class CreatingCollectionOutput(BaseModel):
    """Output model for CreatingCollectionService"""
    status: bool
    already_exists: bool = False
    message: str = ''
    collection_id: Optional[uuid.UUID] = None


class CreatingCollectionService(BaseService):
    """Service to handle collection creation operations"""

    settings: PostgresSettings

    @property
    def postgres_db(self) -> SQLDatabase:
        """Get postgres_db instance"""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    @property
    def collection_controller(self) -> CollectionController:
        """Get collection controller instance"""
        return CollectionController()

    async def process(self, input: CreatingCollectionInput, db=None) -> CreatingCollectionOutput:
        """
        Create a new collection in the database

        Args:
            input: CreatingCollectionInput with collection details
            db: Optional database session (if None, creates new session)

        Returns:
            CreatingCollectionOutput with status
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return await self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return await self._process_with_session(input, session)
            except Exception as e:
                logger.error(
                    f'Error creating collection {input.collection_name}: {str(e)}',
                )
                return CreatingCollectionOutput(
                    status=False,
                    already_exists=False,
                    message=f"Failed to create collection: {str(e)}",
                )

    async def _process_with_session(self, input: CreatingCollectionInput, db) -> CreatingCollectionOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Note: user_id is validated by JWT token from Keycloak
            # No need to check if user exists in local database

            # Check if collection already exists for this user
            existing_collections = self.collection_controller.get_all(
                session=db,
                filter={
                    'collection_name': input.collection_name,
                    'user_id': input.user_id,
                },
                limit=1,
            )

            if existing_collections and len(existing_collections) > 0:
                existing_collection = existing_collections[0]
                logger.info(
                    f'Collection already exists: {existing_collection.id} with name: {input.collection_name}',
                )
                return CreatingCollectionOutput(
                    status=True,
                    already_exists=True,
                    message=f"Collection '{input.collection_name}' already exists",
                    collection_id=existing_collection.id,
                )

            # Create Collection object if not exists
            collection = Collection(
                collection_name=input.collection_name,
                description=input.description or '',
                user_id=input.user_id,
                collection_style=input.collection_style,
                creativity_level=input.creativity_level,
            )

            # Insert collection using controller
            saved_collection = self.collection_controller.insert(
                session=db,
                model=collection,
            )

            logger.info(
                f'Successfully created collection: {saved_collection.id} with name: {input.collection_name}',
            )

            return CreatingCollectionOutput(
                status=True,
                already_exists=False,
                message=f"Collection '{input.collection_name}' created successfully",
                collection_id=saved_collection.id,
            )

        except Exception as e:
            logger.error(
                f'Error creating collection {input.collection_name}: {str(e)}',
            )
            return CreatingCollectionOutput(
                status=False,
                already_exists=False,
                message=f"Failed to create collection: {str(e)}",
            )
