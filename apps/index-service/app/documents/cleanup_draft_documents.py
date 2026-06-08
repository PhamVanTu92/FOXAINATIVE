"""Auto-Cleanup Service for Draft Documents.

This service automatically removes draft documents that have been abandoned
(uploaded but never processed) after a configurable grace period.

Cleanup policy:
- Documents with status='draft' created more than 24 hours ago
- Hard delete: Remove from MinIO storage + PostgreSQL database
- Runs every 6 hours via APScheduler

This prevents "zombie documents" from accumulating in storage.
"""
from __future__ import annotations

from datetime import timedelta
from typing import List
from urllib.parse import unquote

from api.helpers.dependencies.database import get_db_session_factory
from joint.logging import get_logger
from joint.minio_storage import get_minio_service
from joint.postgres.models import get_vietnam_now
from joint.settings import Settings

logger = get_logger(__name__)


class CleanupDraftDocumentsService:
    """
    Service to clean up abandoned draft documents.

    Uses factory pattern for database sessions to prevent connection pool
    exhaustion during cleanup operations.

    This service:
    1. Finds draft documents older than grace period (24h default)
    2. Deletes files from MinIO storage
    3. Deletes records from PostgreSQL database
    4. Logs cleanup statistics
    """

    def __init__(self, settings: Settings, grace_period_hours: int = 24):
        """Initialize cleanup service with shared connection pool.

        Args:
            settings: Application settings.
            grace_period_hours: Hours to wait before cleaning up draft (default: 24).
        """
        self.settings = settings
        self.grace_period_hours = grace_period_hours
        self.minio_service = get_minio_service(settings)
        # Use factory pattern for short-lived sessions
        self._db_session_factory = get_db_session_factory(settings.postgres)

    async def cleanup_draft_documents(self) -> dict:
        """
        Clean up draft documents older than grace period.

        Returns:
            dict: Cleanup statistics with counts and errors
        """
        try:
            # Use timezone-aware Vietnam time so the comparison matches the
            # created_at column (stored as timezone-aware timestamptz). A naive
            # datetime.now() here would be off by the TZ offset (~7h).
            cutoff_time = get_vietnam_now() - timedelta(hours=self.grace_period_hours)

            logger.info(
                f"Starting draft document cleanup. "
                f"Grace period: {self.grace_period_hours}h, "
                f"Cutoff time: {cutoff_time.isoformat()}",
            )

            # Get draft documents to cleanup
            draft_documents = self._get_draft_documents_to_cleanup(cutoff_time)

            if not draft_documents or len(draft_documents) == 0:
                logger.info('No draft documents to cleanup')
                return {
                    'success': True,
                    'total_found': 0,
                    'successfully_deleted': 0,
                    'failed_to_delete': 0,
                    'errors': [],
                }

            logger.info(
                f"Found {len(draft_documents)} draft documents to cleanup",
            )

            # Delete documents
            results = await self._delete_documents(draft_documents)

            logger.info(
                f"Cleanup completed: {results['successfully_deleted']} deleted, "
                f"{results['failed_to_delete']} failed",
            )

            return results

        except Exception as e:
            logger.error(f"Failed to cleanup draft documents: {str(e)}")
            return {
                'success': False,
                'total_found': 0,
                'successfully_deleted': 0,
                'failed_to_delete': 0,
                'errors': [str(e)],
            }

    def _get_draft_documents_to_cleanup(self, cutoff_time: datetime) -> List[dict]:
        """Get list of draft documents older than cutoff time.

        Uses short-lived session from factory to prevent connection pool exhaustion.

        Args:
            cutoff_time: Documents created before this time will be selected.

        Returns:
            List of document dicts with id, file_url, display_name.
        """
        try:
            with self._db_session_factory() as session:
                from joint.postgres.models import Document as DocumentModel

                # Query draft documents older than cutoff
                drafts = session.query(DocumentModel).filter(
                    DocumentModel.processing_status == 'draft',
                    DocumentModel.created_at < cutoff_time,
                ).all()

                # Convert to dict for easier handling
                draft_list = [
                    {
                        'id': str(doc.id),
                        'file_url': doc.file_url,
                        'display_name': doc.display_name,
                        'created_at': doc.created_at.isoformat(),
                        'file_name': doc.file_name,
                    }
                    for doc in drafts
                ]

                return draft_list

        except Exception as e:
            logger.error(f"Error querying draft documents: {str(e)}")
            return []

    async def _delete_documents(self, documents: List[dict]) -> dict:
        """
        Delete documents from MinIO and PostgreSQL.

        Args:
            documents: List of document dicts to delete

        Returns:
            dict: Statistics with success/failure counts
        """
        successfully_deleted = 0
        failed_to_delete = 0
        errors = []

        for doc in documents:
            try:
                doc_id = doc['id']
                file_url = doc['file_url']
                display_name = doc['display_name']

                # Step 1: Delete from MinIO
                minio_deleted = await self._delete_from_minio(file_url)
                if not minio_deleted:
                    logger.warning(
                        f"Failed to delete MinIO file for document {doc_id}",
                    )
                    # Continue anyway to delete DB record

                # Step 2: Delete from PostgreSQL
                db_deleted = self._delete_from_database(doc_id)
                if not db_deleted:
                    logger.error(
                        f"Failed to delete database record for document {doc_id}",
                    )
                    failed_to_delete += 1
                    errors.append(f"DB deletion failed for {doc_id}")
                    continue

                # Success
                successfully_deleted += 1
                logger.info(
                    f"Successfully deleted draft document: {display_name} (ID: {doc_id})",
                )

            except Exception as e:
                failed_to_delete += 1
                error_msg = f"Failed to delete document {doc.get('id', 'unknown')}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)

        return {
            'success': True,
            'total_found': len(documents),
            'successfully_deleted': successfully_deleted,
            'failed_to_delete': failed_to_delete,
            'errors': errors,
        }

    async def _delete_from_minio(self, file_url: str) -> bool:
        """
        Delete file from MinIO storage.

        Args:
            file_url: Full URL to the file in MinIO

        Returns:
            bool: True if deleted successfully, False otherwise
        """
        try:
            # Parse MinIO URL to get bucket and object_name
            # Format: https://host/files/bucket/object_name
            parts = file_url.split('/files/')
            if len(parts) != 2:
                logger.error(f"Invalid MinIO URL format: {file_url}")
                return False

            bucket_and_object = parts[1]
            bucket_name, object_name = bucket_and_object.split('/', 1)
            object_name = unquote(object_name)  # URL decode

            # Delete from MinIO
            self.minio_service.delete_object(bucket_name, object_name)
            logger.debug(f"Deleted MinIO object: {bucket_name}/{object_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting from MinIO: {str(e)}")
            return False

    def _delete_from_database(self, document_id: str) -> bool:
        """Delete document record from PostgreSQL.

        Uses short-lived session from factory to prevent connection pool exhaustion.

        Args:
            document_id: UUID of the document to delete.

        Returns:
            bool: True if deleted successfully, False otherwise.
        """
        try:
            with self._db_session_factory() as session:
                from joint.postgres.models import Document as DocumentModel
                from uuid import UUID

                # Find and delete document
                document = session.query(DocumentModel).filter(
                    DocumentModel.id == UUID(document_id),
                ).first()

                if not document:
                    logger.warning(
                        f"Document {document_id} not found in database",
                    )
                    return False

                session.delete(document)
                session.commit()
                logger.debug(
                    f"Deleted database record for document {document_id}",
                )
                return True

        except Exception as e:
            logger.error(f"Error deleting from database: {str(e)}")
            return False


# Singleton instance for scheduler
_cleanup_service_instance = None


def get_cleanup_service(settings: Settings) -> CleanupDraftDocumentsService:
    """Get or create singleton cleanup service instance"""
    global _cleanup_service_instance
    if _cleanup_service_instance is None:
        _cleanup_service_instance = CleanupDraftDocumentsService(
            settings=settings,
            grace_period_hours=24,  # 24 hours grace period
        )
    return _cleanup_service_instance


async def scheduled_cleanup_job():
    """
    Scheduled job to run cleanup of draft documents.

    This function is called by APScheduler every 6 hours.
    """
    try:
        from joint.utils import get_settings

        logger.info('=' * 80)
        logger.info('SCHEDULED DRAFT CLEANUP JOB STARTED')
        logger.info('=' * 80)

        settings = get_settings()
        cleanup_service = get_cleanup_service(settings)
        results = await cleanup_service.cleanup_draft_documents()

        logger.info('=' * 80)
        logger.info('CLEANUP JOB RESULTS:')
        logger.info(f"  Total found: {results['total_found']}")
        logger.info(
            f"  Successfully deleted: {results['successfully_deleted']}",
        )
        logger.info(f"  Failed to delete: {results['failed_to_delete']}")
        if results['errors']:
            logger.error(f"  Errors: {', '.join(results['errors'])}")
        logger.info('=' * 80)

    except Exception as e:
        logger.error(f"Scheduled cleanup job failed: {str(e)}")
        logger.error('=' * 80)
