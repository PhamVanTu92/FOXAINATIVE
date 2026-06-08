from __future__ import annotations

from uuid import UUID

from urllib.parse import unquote

from domain.db_service.document_services import DeletingDocumentInput
from domain.db_service.document_services import DeletingDocumentService
from domain.storage_services import QdrantService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging.logger import get_logger
from joint.minio_storage import get_minio_service
from joint.minio_storage import MinioService
from joint.settings import Settings

logger = get_logger(__name__)


class DocumentDeletionInput(BaseModel):
    """Input model for deleting a document"""
    document_id: UUID
    collection_name: str


class DocumentDeletionOutput(BaseModel):
    """Output model for successful document deletion"""
    message: str
    document_id: str


class DocumentDeletionService(BaseService):
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
    def deleting_document_service(self) -> DeletingDocumentService:
        return DeletingDocumentService(settings=self.settings.postgres)

    @property
    def minio_service(self) -> MinioService:
        return get_minio_service(self.settings)

    def _delete_minio_file(self, file_url: str, document_name: str) -> None:
        """Best-effort removal of the document's object from MinIO.

        file_url format: ``{public_url_base}/files/{bucket}/{object_name}``.
        Failures are logged but never abort the deletion (PostgreSQL and
        Qdrant are already cleaned up at this point).
        """
        if not file_url:
            logger.warning(
                f"No file_url for document '{document_name}'; skipping MinIO cleanup",
            )
            return
        try:
            parts = file_url.split('/files/')
            if len(parts) != 2:
                logger.warning(
                    f"Cannot parse file_url for MinIO cleanup: {file_url}",
                )
                return
            bucket_name, object_name = parts[1].split('/', 1)
            object_name = unquote(object_name)
            self.minio_service.delete_object(bucket_name, object_name)
            logger.info(
                f"Deleted MinIO object for document '{document_name}': {object_name}",
            )
        except Exception as minio_error:
            logger.warning(
                f"Failed to delete MinIO file for document '{document_name}': {minio_error}",
            )

    async def process(self, inputs: DocumentDeletionInput, db_session=None) -> DocumentDeletionOutput:
        """
        Deletes a document from both PostgreSQL and Qdrant.

        Args:
            inputs: DocumentDeletionInput containing document_id

        Returns:
            DocumentDeletionOutput with success message

        Raises:
            Exception: If document deletion fails in either system
        """
        try:
            logger.info(
                f"Starting document deletion for ID: {inputs.document_id}",
            )

            # Step 1: Delete document from PostgreSQL first
            postgres_input = DeletingDocumentInput(
                document_id=inputs.document_id,
            )

            postgres_result = await self.deleting_document_service.process(postgres_input, db_session)

            if not postgres_result.status:
                raise Exception(
                    f"Failed to delete document from PostgreSQL: {postgres_result.message}",
                )

            document_name = postgres_result.document_name
            logger.info(
                f"Document '{document_name}' deleted from PostgreSQL successfully",
            )

            # Step 2: Delete document from Qdrant using the document_name
            qdrant_deleted = await self.qdrant_service.delete_document(
                collection_name=inputs.collection_name,
                document_name=document_name,
            )

            if qdrant_deleted:
                logger.info(
                    f"Document '{document_name}' deleted from Qdrant successfully",
                )
            else:
                logger.warning(
                    f"Collection '{inputs.collection_name}' was not found in Qdrant (may not exist)",
                )

            # Step 3: Delete the underlying file from MinIO storage.
            # Without this the object is orphaned in storage forever.
            self._delete_minio_file(postgres_result.file_url, document_name)

            return DocumentDeletionOutput(
                message=f"Document '{document_name}' deleted successfully",
                document_id=str(inputs.document_id),
            )

        except Exception as e:
            logger.error(
                f"Failed to delete document ID '{inputs.document_id}': {str(e)}",
            )
            raise Exception(f"Document deletion failed: {str(e)}")
