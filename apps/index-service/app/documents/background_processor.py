from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from api.helpers.dependencies.database import get_db_session_factory
from domain.db_service.document_services import UpdatingDocumentInput
from domain.db_service.document_services import UpdatingDocumentService
from joint.logging import get_logger
from joint.minio_storage import get_minio_service
from joint.postgres.models import get_vietnam_now
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.settings.settings import Settings
from joint.postgres.database import ChunkController
from joint.postgres.database.schemas import Chunk as ChunkSchema
from sqlalchemy.orm import Session

from .create_document import DocumentCreationService

logger = get_logger(__name__)


class DocumentBackgroundProcessor:
    """
    Background processor for document upload and processing tasks.

    Uses factory pattern for database sessions to prevent connection pool
    exhaustion during long-running batch operations.
    """

    def __init__(self, settings: Settings):
        """Initialize background processor with shared connection pool.

        Args:
            settings: Application settings.
        """
        self.settings = settings
        self.document_creation_service = DocumentCreationService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )
        self.updating_document_service = UpdatingDocumentService(
            settings=settings.postgres,
        )
        # Use factory pattern for short-lived sessions
        self._db_session_factory = get_db_session_factory(settings.postgres)
        # Use singleton MinIO service for file downloads
        self.minio_service = get_minio_service(settings)

    async def process_document(
        self,
        document_id: uuid.UUID,
        db_session=None,
    ):
        """
        Process document in the background (NEW 2-step flow).

        This method:
        1. Gets document info from database (file_url, collection_id, etc.)
        2. Downloads file from MinIO to temp location
        3. Updates document status to 'processing'
        4. Calls document creation service (parsing, embedding, indexing)
        5. Updates progress at each step
        6. Marks document as completed or failed
        7. Cleans up temporary files

        Args:
            document_id: UUID of the document to process
            db_session: Database session (optional, will use factory if not provided)
        """
        temp_file_path = None
        try:
            logger.info(
                f'Starting background processing for document: {document_id}',
            )

            # Get database session using factory pattern for short-lived connection
            if db_session is None:
                with self._db_session_factory() as session:
                    return await self._process_document_with_session(document_id, session, temp_file_path)
            else:
                return await self._process_document_with_session(document_id, db_session, temp_file_path)

        except Exception as e:
            logger.error(
                f'Error in process_document wrapper: {e}', exc_info=True,
            )
            raise

    async def _process_document_with_session(
        self,
        document_id: uuid.UUID,
        db_session: Session,
        temp_file_path: Optional[str],
    ):
        """
        Internal method to process document with provided session.

        Args:
            document_id: UUID of the document to process.
            db_session: Database session.
            temp_file_path: Temporary file path for cleanup.
        """
        try:
            # Step 0: Get document info from database
            # OPTIMIZATION: Use joinedload to fetch collection in ONE query instead of two
            from joint.postgres.models import Document as DocumentModel
            from sqlalchemy.orm import joinedload

            document = db_session.query(DocumentModel).options(
                # Eager load collection relationship
                joinedload(DocumentModel.collection),
            ).filter(DocumentModel.id == document_id).first()

            if not document:
                raise ValueError(f"Document with ID {document_id} not found")

            # Extract document info
            file_url = document.file_url
            file_name = document.file_name
            collection_id = document.collection_id
            user_id = document.user_id
            processing_type = document.processing_type
            effective_from = document.effective_from
            effective_to = document.effective_to
            issuing_unit = document.issuing_unit
            access_scope = document.access_scope
            version = document.version

            # CRITICAL: Check if document is still in draft status or processing_type is None
            if document.processing_status == 'draft' or processing_type is None:
                logger.warning(
                    f'Document {document_id}: status={document.processing_status}, '
                    f'processing_type={processing_type} - document not yet committed. '
                    f'Skipping background processing.',
                )
                return

            # Get collection name from eager-loaded relationship (NO EXTRA QUERY!)
            if not document.collection:
                raise ValueError(
                    f"Collection with ID {collection_id} not found",
                )
            collection_name = document.collection.collection_name

            logger.info(
                f'Document {document_id}: Retrieved document info - file_url: {file_url}',
            )

            # Step 1: Download file from MinIO to temp location
            # OPTIMIZATION: Only update status to 'processing' once at the beginning
            await self._update_document_progress(
                document_id=document_id,
                processing_status='processing',
                progress=0,
                current_step='starting processing',
                session=db_session,
            )

            # Parse file_url to get bucket and object_name
            # Format: https://host/files/bucket/object_name
            from urllib.parse import unquote
            parts = file_url.split('/files/')
            if len(parts) != 2:
                raise ValueError(f'Invalid file_url format: {file_url}')

            bucket_and_object = parts[1]
            bucket_name, object_name = bucket_and_object.split('/', 1)
            object_name = unquote(object_name)

            # Download to temp
            temp_dir = Path('/tmp/document_processing')
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file_path = str(temp_dir / f'{document_id}_{file_name}')

            # Download file from MinIO (returns Future, need to call .result() to block and wait)
            download_future = self.minio_service.download_file(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=str(temp_file_path),
            )
            download_future.result()  # Block until download completes

            logger.info(
                f'Document {document_id}: Downloaded file from MinIO to {temp_file_path}',
            )

            # OPTIMIZATION: Removed intermediate progress updates (20%, 40%)
            # Only update at critical milestones to reduce DB calls
            logger.info(
                f'Document {document_id}: Starting document parsing and indexing',
            )

            # Parse document based on processing_type
            logger.info(
                f'Document {document_id}: Parsing document with type={processing_type}',
            )
            from .create_document import DocumentCreationInput as DocInput
            doc_input = DocInput(
                storage_path=str(temp_file_path),
                collection_id=collection_id,
                user_id=user_id,
                collection_name=collection_name.strip(),
                processing_type=processing_type,
                effective_from=effective_from.isoformat() if effective_from else None,
                effective_to=effective_to.isoformat() if effective_to else None,
                issuing_unit=issuing_unit,
                access_scope=access_scope,
                version=version,
            )

            # Override document_name in chunks to use display_name (without UUID prefix)
            # This ensures consistency between PostgreSQL and Qdrant
            display_name = document.display_name

            # Parse and chunk document
            doc_chunks = await self.document_creation_service._process_document_by_type(doc_input)

            if not doc_chunks:
                raise ValueError('No chunks were generated from document')

            # Fix document_name in all chunks to use display_name instead of temp file name
            for chunk in doc_chunks:
                if hasattr(chunk, 'metadata') and isinstance(chunk.metadata, dict):
                    chunk.metadata['document_name'] = display_name

            logger.info(
                f'Document {document_id}: Generated {len(doc_chunks)} chunks with document_name={display_name}',
            )

            # OPTIMIZATION: Update progress to 40% after parsing
            await self._update_document_progress(
                document_id=document_id,
                progress=40,
                current_step='preparing chunks metadata',
                session=db_session,
            )

            # Step 4: Prepare chunk metadata for Qdrant
            logger.info(
                f'Document {document_id}: Preparing {len(doc_chunks)} chunks with metadata for Qdrant',
            )

            # Pre-generate all Qdrant point IDs to maintain consistency
            qdrant_point_ids = [uuid.uuid4() for _ in range(len(doc_chunks))]

            for idx, doc_chunk in enumerate(doc_chunks):
                # Use pre-generated Qdrant point ID
                qdrant_point_id = qdrant_point_ids[idx]

                # Prepare chunk metadata
                chunk_metadata = doc_chunk.metadata.copy() if hasattr(doc_chunk, 'metadata') else {}

                # Add metadata for Qdrant (chunk tracking via metadata only, no PostgreSQL storage)
                chunk_metadata['document_id'] = str(document_id)
                chunk_metadata['chunk_index'] = idx
                chunk_metadata['qdrant_point_id'] = str(qdrant_point_id)
                # Add file_url for retrieval access
                chunk_metadata['file_url'] = file_url

                # Update doc_chunk metadata (will be used by Qdrant seeder)
                doc_chunk.metadata = chunk_metadata

            logger.info(
                f'Document {document_id}: Prepared {len(doc_chunks)} chunks with metadata',
            )

            # Step 5: Save chunks to PostgreSQL (bulk insert)
            logger.info(
                f'Document {document_id}: Saving {len(doc_chunks)} chunks to PostgreSQL',
            )

            chunk_schemas = []
            for idx, doc_chunk in enumerate(doc_chunks):
                chunk_meta = doc_chunk.metadata.copy() if hasattr(doc_chunk, 'metadata') else {}
                chunk_meta['chunk_id'] = str(uuid.uuid4())
                chunk_meta['is_enabled'] = True
                chunk_schemas.append(ChunkSchema(
                    id=uuid.UUID(chunk_meta['chunk_id']),
                    document_id=document_id,
                    user_id=user_id,
                    chunk_index=idx,
                    content=doc_chunk.page_content if hasattr(doc_chunk, 'page_content') else str(doc_chunk),
                    content_length=len(doc_chunk.page_content) if hasattr(doc_chunk, 'page_content') else 0,
                    qdrant_point_id=qdrant_point_ids[idx],
                    metadata=chunk_meta,
                    is_enabled=True,
                    deleted=False,
                ))

            chunk_controller = ChunkController()
            chunk_controller.bulk_insert(db_session, chunk_schemas)
            db_session.commit()

            logger.info(
                f'Document {document_id}: Saved {len(chunk_schemas)} chunks to PostgreSQL',
            )

            # OPTIMIZATION: Update progress to 70% after chunk saving
            await self._update_document_progress(
                document_id=document_id,
                progress=70,
                current_step='uploading to vector store',
                session=db_session,
            )

            logger.info(f'Document {document_id}: Uploading chunks to Qdrant')
            try:
                await self.document_creation_service._upload_to_qdrant_by_type(
                    processing_type=processing_type,
                    doc_chunks=doc_chunks,
                    collection_name=collection_name.strip(),
                    effective_from=effective_from.isoformat() if effective_from else None,
                    effective_to=effective_to.isoformat() if effective_to else None,
                    issuing_unit=issuing_unit,
                    access_scope=access_scope,
                    version=version,
                )
            except Exception as qdrant_error:
                # Qdrant push failed AFTER chunks were committed to PostgreSQL.
                # Roll back those chunks so we don't leave orphans (present in PG
                # but absent in Qdrant), which would also cause duplicates on retry.
                logger.error(
                    f'Document {document_id}: Qdrant upload failed, rolling back '
                    f'{len(chunk_schemas)} PostgreSQL chunks: {qdrant_error}',
                )
                try:
                    from joint.postgres.models import Chunk as ChunkModel
                    db_session.query(ChunkModel).filter(
                        ChunkModel.document_id == document_id,
                    ).delete(synchronize_session=False)
                    db_session.commit()
                except Exception as cleanup_error:
                    db_session.rollback()
                    logger.error(
                        f'Document {document_id}: Failed to roll back chunks: {cleanup_error}',
                    )
                raise

            logger.info(
                f'Document {document_id}: Successfully uploaded to Qdrant',
            )

            # Step 5: Mark document as completed (100%)
            await self._update_document_progress(
                document_id=document_id,
                processing_status='completed',
                progress=100,
                current_step='completed',
                completed_at=get_vietnam_now(),
                session=db_session,
            )

            logger.info(
                f'Document {document_id}: Document processing completed successfully.',
            )

        except Exception as e:
            # Mark document as failed
            logger.error(
                f'Document {document_id}: Document processing failed: {str(e)}',
            )

            try:
                with self._db_session_factory() as db_session:
                    await self._update_document_progress(
                        document_id=document_id,
                        processing_status='failed',
                        progress=0,
                        error_message=str(e),
                        completed_at=get_vietnam_now(),
                        session=db_session,
                    )
            except Exception as update_error:
                logger.error(
                    f'Document {document_id}: Failed to update document status to failed: {str(update_error)}',
                )

        finally:
            # Clean up temporary file
            if temp_file_path is not None and Path(temp_file_path).exists():
                try:
                    os.remove(temp_file_path)
                    logger.debug(
                        f'Document {document_id}: Cleaned up temporary file: {temp_file_path}',
                    )
                except Exception as cleanup_error:
                    logger.warning(
                        f'Document {document_id}: Failed to clean up temporary file {temp_file_path}: {cleanup_error}',
                    )

    async def _update_document_progress(
        self,
        document_id: uuid.UUID,
        processing_status: Optional[str] = None,
        progress: Optional[int] = None,
        current_step: Optional[str] = None,
        error_message: Optional[str] = None,
        file_url: Optional[str] = None,
        completed_at: Optional[datetime] = None,
        session=None,
    ):
        """Helper method to update document progress"""
        try:
            update_input = UpdatingDocumentInput(
                document_id=document_id,
                processing_status=processing_status,
                progress=progress,
                current_step=current_step,
                error_message=error_message,
                file_url=file_url,
                completed_at=completed_at,
            )

            await self.updating_document_service.process(update_input, session)

            logger.debug(
                f'Document {document_id}: Progress updated - '
                f'Status: {processing_status}, Progress: {progress}%, Step: {current_step}',
            )

        except Exception as e:
            logger.error(
                f'Document {document_id}: Failed to update progress: {str(e)}',
            )
            # Don't raise - we don't want to fail the whole process because of progress update failure
