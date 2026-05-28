from __future__ import annotations

from typing import List
from typing import Optional

from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.postgres import SQLDatabase
from joint.postgres.models import Collection
from joint.postgres.models import Document
from joint.settings.settings import PostgresSettings
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = get_logger(__name__)


class GettingDocumentNamesInput(BaseModel):
    """Input model for GettingDocumentNamesService."""

    collection_name: str
    processing_status: Optional[str] = 'completed'


class GettingDocumentNamesOutput(BaseModel):
    """Output model for GettingDocumentNamesService."""

    status: bool
    document_names: List[str] = []
    total: int = 0
    message: str = ''


class GettingDocumentNamesService(BaseService):
    """Service to retrieve distinct document display names by collection name.

    Used by internal service-to-service endpoints for document listing
    in RAG and comparison workflows.
    """

    settings: PostgresSettings

    @property
    def postgres_db(self) -> SQLDatabase:
        """Get postgres_db instance."""
        return SQLDatabase(
            host=self.settings.host,
            port=self.settings.port,
            db=self.settings.db,
            username=self.settings.username,
            password=self.settings.password,
        )

    async def process(
        self,
        input: GettingDocumentNamesInput,
        db: Session = None,
    ) -> GettingDocumentNamesOutput:
        """
        Get distinct document display names for a collection.

        Args:
            input: GettingDocumentNamesInput with collection_name and optional filters.
            db: Optional database session (if None, creates new session).

        Returns:
            GettingDocumentNamesOutput with document names list and count.
        """
        if db is not None:
            return self._process_with_session(input, db)
        else:
            try:
                with self.postgres_db.sessionmaker() as session:
                    return self._process_with_session(input, session)
            except Exception as e:
                logger.error(f"Error getting document names: {str(e)}")
                return GettingDocumentNamesOutput(
                    status=False,
                    message=f"Failed to retrieve document names: {str(e)}",
                )

    def _process_with_session(
        self,
        input: GettingDocumentNamesInput,
        db: Session,
    ) -> GettingDocumentNamesOutput:
        """Internal method that performs the query with a provided session."""
        try:
            if not input.collection_name or not input.collection_name.strip():
                return GettingDocumentNamesOutput(
                    status=False,
                    message='Collection name cannot be empty',
                )

            # Build query for distinct display_names via collection join
            stmt = (
                select(Document.display_name)
                .join(Collection, Document.collection_id == Collection.id)
                .where(Collection.collection_name == input.collection_name)
                .where(Document.processing_status != 'draft')
            )

            if input.processing_status:
                stmt = stmt.where(
                    Document.processing_status == input.processing_status,
                )

            stmt = stmt.distinct().order_by(Document.display_name)

            result = db.execute(stmt)
            document_names = [row[0] for row in result.fetchall()]

            logger.info(
                f"Retrieved {len(document_names)} document names "
                f"for collection: {input.collection_name}",
            )

            return GettingDocumentNamesOutput(
                status=True,
                document_names=document_names,
                total=len(document_names),
                message=f"Successfully retrieved {len(document_names)} document names",
            )

        except Exception as e:
            logger.error(f"Error getting document names: {str(e)}")
            return GettingDocumentNamesOutput(
                status=False,
                message=f"Failed to retrieve document names: {str(e)}",
            )
