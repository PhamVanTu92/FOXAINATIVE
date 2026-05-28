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
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class GettingCollectionDescriptionInput(BaseModel):
    """Input model for GettingCollectionDescriptionService"""
    collection_name: str
    user_id: Optional[uuid.UUID] = None


class GettingCollectionDescriptionOutput(BaseModel):
    """Output model for GettingCollectionDescriptionService"""
    status: bool
    description: Optional[str] = None
    collection_data: Optional[Collection] = None
    message: str = ''


class GettingCollectionDescriptionService(BaseService):
    """Service to handle getting collection description by collection name"""

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

    def process(
        self,
        input: GettingCollectionDescriptionInput,
        db: Session = None,
    ) -> GettingCollectionDescriptionOutput:
        """
        Get collection description by collection name

        Args:
            input: GettingCollectionDescriptionInput with collection_name and optional filters
            db: Optional database session (if None, creates new session)

        Returns:
            GettingCollectionDescriptionOutput with collection description
        """
        if db is not None:
            # Use provided session (from dependency injection)
            return self._process_with_session(input, db)
        else:
            # Create own session (for backward compatibility)
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(f"Error getting collection description: {str(e)}")
                return GettingCollectionDescriptionOutput(
                    status=False,
                    message=f"Failed to retrieve collection description: {str(e)}",
                )

    def _process_with_session(
        self,
        input: GettingCollectionDescriptionInput,
        db: Session,
    ) -> GettingCollectionDescriptionOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Validate input
            if not input.collection_name or not input.collection_name.strip():
                return GettingCollectionDescriptionOutput(
                    status=False,
                    message='Collection name cannot be empty',
                )

            # Find collection by name
            collection = self._find_collection_by_name(db, input)

            if not collection:
                logger.info(f"Collection not found: {input.collection_name}")
                return GettingCollectionDescriptionOutput(
                    status=False,
                    message=f"Collection '{input.collection_name}' not found",
                )

            logger.info(
                f"Successfully retrieved description for collection: {input.collection_name}",
            )

            return GettingCollectionDescriptionOutput(
                status=True,
                description=collection.description,
                collection_data=collection,
                message=f"Successfully retrieved description for collection '{input.collection_name}'",
            )

        except Exception as e:
            logger.error(f"Error getting collection description: {str(e)}")
            return GettingCollectionDescriptionOutput(
                status=False,
                message=f"Failed to retrieve collection description: {str(e)}",
            )

    def _find_collection_by_name(
        self,
        session: Session,
        input: GettingCollectionDescriptionInput,
    ) -> Optional[Collection]:
        """Find collection by name with optional user_id filter"""
        try:
            from joint.postgres.models import Collection as CollectionModel

            # Build query with collection_name filter
            stmt = select(CollectionModel).filter(
                CollectionModel.collection_name == input.collection_name,
            )

            # Add optional user_id filter
            if input.user_id:
                stmt = stmt.filter(CollectionModel.user_id == input.user_id)

            # Execute query and get first result
            result = session.execute(stmt).scalars().first()

            if result:
                # Convert to schema
                return Collection.model_validate(result)

            return None

        except Exception as e:
            logger.error(f"Error finding collection by name: {str(e)}")
            return None
