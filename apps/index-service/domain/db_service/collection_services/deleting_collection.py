from __future__ import annotations

import uuid

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.database import CollectionController
from joint.postgres.database import DocumentController
from joint.settings.settings import PostgresSettings
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class DeletingCollectionInput(BaseModel):
    """Input model for DeletingCollectionService"""
    collection_id: uuid.UUID


class DeletingCollectionOutput(BaseModel):
    """Output model for DeletingCollectionService"""
    status: bool
    collection_name: str
    message: str


class DeletingCollectionService(BaseService):
    """Service to handle collection deletion operations"""

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

    @property
    def document_controller(self) -> DocumentController:
        """Get document controller instance"""
        return DocumentController()

    async def process(
        self,
        input: DeletingCollectionInput,
        db: Session = None,
    ) -> DeletingCollectionOutput:
        """
        Delete a collection from the database

        Args:
            input: DeletingCollectionInput with collection_id
            db: Optional database session (if None, creates new session)

        Returns:
            DeletingCollectionOutput with status and collection info
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
                    f'Error deleting collection with ID {input.collection_id}: {str(e)}',
                )
                return DeletingCollectionOutput(
                    status=False,
                    collection_name='',
                    message=f'Failed to delete collection: {str(e)}',
                )

    async def _process_with_session(self, input: DeletingCollectionInput, db) -> DeletingCollectionOutput:
        """Internal method that does the actual work with a provided session"""
        try:
            # Find collection by ID
            collection = self.collection_controller.get_by_id(
                session=db,
                id=input.collection_id,
            )

            if not collection:
                logger.warning(
                    f'Collection not found with ID: {input.collection_id}',
                )
                return DeletingCollectionOutput(
                    status=False,
                    collection_name='',
                    message=f"Collection with ID '{input.collection_id}' not found",
                )

            collection_name = collection.collection_name
            logger.info(
                f'Found collection to delete: {collection_name} (ID: {input.collection_id})',
            )

            # Delete all documents in this collection
            documents = self.document_controller.get_all(
                session=db,
                filter={'collection_id': input.collection_id},
            )

            if documents:
                logger.info(
                    f'Found {len(documents)} documents to delete in collection {collection_name}',
                )
                for document in documents:
                    deleted_doc = self.document_controller.delete(
                        session=db,
                        id=document.id,
                    )
                    if deleted_doc:
                        logger.info(
                            f'Deleted document: {document.display_name} (ID: {document.id})',
                        )
                    else:
                        logger.warning(
                            f'Failed to delete document: {document.display_name} (ID: {document.id})',
                        )

                logger.info(
                    f'Completed deleting documents from collection {collection_name}',
                )
            else:
                logger.info(
                    f'No documents found in collection {collection_name}',
                )

            # Now delete the collection
            deleted_collection = self.collection_controller.delete(
                session=db,
                id=input.collection_id,
            )

            if deleted_collection:
                logger.info(
                    f'Successfully deleted collection: {collection_name} (ID: {input.collection_id})',
                )
                return DeletingCollectionOutput(
                    status=True,
                    collection_name=collection_name,
                    message=f"Collection '{collection_name}' deleted successfully",
                )
            else:
                logger.error(
                    f'Failed to delete collection: {collection_name} (ID: {input.collection_id})',
                )
                return DeletingCollectionOutput(
                    status=False,
                    collection_name=collection_name,
                    message=f"Failed to delete collection '{collection_name}'",
                )

        except Exception as e:
            logger.error(
                f'Error deleting collection with ID {input.collection_id}: {str(e)}',
            )
            return DeletingCollectionOutput(
                status=False,
                collection_name='',
                message=f'Failed to delete collection: {str(e)}',
            )
