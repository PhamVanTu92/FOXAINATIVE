"""
Batch Document Upload Service (Step 1 - Upload Only)

This module handles batch uploading of multiple documents WITHOUT processing.
Processing will be triggered separately via BatchProcessDocumentService.
"""
from __future__ import annotations

import asyncio
import os
import uuid as uuid_lib
from pathlib import Path
from typing import Any
from typing import Dict
from typing import List
from urllib.parse import quote
from uuid import UUID

from domain.db_service.document_services import CreatingDocumentInput
from domain.db_service.document_services import CreatingDocumentService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.minio_storage import get_minio_service
from joint.minio_storage import MinioService
from joint.settings import Settings
from joint.utils import detect_content_type

logger = get_logger(__name__)


class BatchUploadInput(BaseModel):
    """Input model for batch uploading documents (upload only, no processing)"""
    files_data: List[Dict[str, Any]]  # List of {file, content, size, filename}
    collection_id: UUID
    user_id: UUID


class BatchUploadOutput(BaseModel):
    """Output model for successful batch document upload"""
    message: str
    # List of {document_id, file_name, file_url, status}
    documents: List[Dict[str, Any]]
    successful_count: int
    failed_count: int
    total_count: int


class BatchUploadService(BaseService):
    """
    Application service for batch document upload (Step 1 of 2-step flow).

    This service ONLY uploads files to MinIO and creates document records.
    Processing is handled separately by BatchProcessDocumentService.

    Documents must already be uploaded via BatchUploadOnlyService.

    Features:
    - Parallel file upload to MinIO
    - Document records created with status='draft', processing_type=None
    - Proper error handling and cleanup
    - Maximum 10 files per batch
    - Maximum 100MB per file
    - Maximum 500MB total batch size
    """

    settings: Settings
    max_files: int = 10
    max_file_size: int = 100 * 1024 * 1024  # 100MB per file
    max_batch_size: int = 500 * 1024 * 1024  # 500MB total
    allowed_extensions: set = {
        '.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.xls',
        '.html', '.htm', '.pptx', '.png', '.jpg', '.jpeg', '.gif',
        '.bmp', '.webp', '.tiff', '.tif',
    }

    @property
    def creating_document_service(self) -> CreatingDocumentService:
        return CreatingDocumentService(settings=self.settings.postgres)

    @property
    def minio_service(self) -> MinioService:
        return get_minio_service(self.settings)

    async def process(self, inputs: BatchUploadInput, db_session=None) -> BatchUploadOutput:
        """
        Upload multiple files to MinIO and create document records (Step 1 only).

        Flow:
        1. Upload all files to MinIO in parallel
        2. Create document records with status='draft', processing_type=None
        3. Return document_ids immediately

        Args:
            inputs: BatchUploadInput with files data and metadata
            db_session: Database session

        Returns:
            BatchUploadOutput with upload results

        Raises:
            Exception: If upload fails
        """
        try:
            logger.info(
                f'Starting batch upload for {len(inputs.files_data)} files',
            )

            # Upload all files to MinIO and create document records
            upload_result = await self._upload_documents_to_minio(
                files_data=inputs.files_data,
                user_id=inputs.user_id,
                collection_id=inputs.collection_id,
                db_session=db_session,
            )

            if not upload_result['success']:
                raise Exception(upload_result.get('message', 'Upload failed'))

            documents_info = upload_result['documents_info']

            logger.info(
                f'Batch upload completed: {len(documents_info)} files uploaded successfully',
            )

            return BatchUploadOutput(
                message=f"Batch upload completed: {len(documents_info)} files uploaded successfully",
                documents=documents_info,
                successful_count=len(documents_info),
                failed_count=0,
                total_count=len(inputs.files_data),
            )

        except Exception as e:
            logger.error(f'Batch upload failed: {str(e)}')
            raise Exception(f"Batch upload failed: {str(e)}")

    async def _upload_documents_to_minio(
        self,
        files_data: List[Dict[str, Any]],
        user_id: UUID,
        collection_id: UUID,
        db_session: Any,
    ) -> Dict[str, Any]:
        """
        Upload files to MinIO and create document records in parallel.

        Args:
            files_data: List of file data dicts (file, content, size, filename)
            user_id: User UUID
            collection_id: Collection UUID
            db_session: Database session

        Returns:
            Dict with 'success', 'documents_info' (list of created document IDs), or 'error' info
        """
        async def upload_single_file(idx: int, file_data: dict):
            """Helper function to upload a single file to MinIO and create document record"""
            file = file_data['file']
            file_content = file_data['content']

            logger.info(
                f'Uploading file {idx + 1}/{len(files_data)}: {file.filename}',
                extra={
                    'file_index': idx,
                    'file_name': file.filename,
                    'file_size': file_data['size'],
                },
            )

            try:
                # Step 1: Upload to MinIO
                file_stem = Path(file.filename).stem
                file_extension = Path(file.filename).suffix
                object_name = f'{uuid_lib.uuid4()}_{file.filename}'
                bucket_name = self.settings.minio.bucket_name

                self.minio_service.ensure_bucket_exists(bucket_name)
                future = self.minio_service.upload_bytes(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    data=file_content,
                    content_type=detect_content_type(file.filename),
                )
                future.result()

                # Generate public URL
                encoded_object_name = quote(object_name, safe='/')
                file_url = f"{self.settings.minio.public_url_base}/files/{bucket_name}/{encoded_object_name}"

                logger.info(f'Uploaded to MinIO: {file_url}')

                # Step 2: Create document record with status='draft', processing_type=None
                doc_input = CreatingDocumentInput(
                    display_name=file_stem,
                    file_name=file.filename,
                    file_url=file_url,
                    collection_id=collection_id,
                    user_id=user_id,
                    file_type=file_extension.lstrip('.'),
                    file_size=file_data['size'],
                    processing_status='draft',  # Draft status - not committed yet
                    progress=0,
                    processing_type=None,  # No processing_type yet - will be set in batch-process
                    effective_from=None,
                    effective_to=None,
                    issuing_unit=None,
                    access_scope=None,
                    version=None,
                )

                doc_result = await self.creating_document_service.process(doc_input, db_session)

                if not doc_result.status:
                    # Cleanup MinIO on DB failure
                    try:
                        self.minio_service.delete_object(
                            bucket_name, object_name,
                        )
                        logger.info(
                            f'Cleaned up MinIO object after DB failure: {object_name}',
                        )
                    except Exception as cleanup_error:
                        logger.warning(
                            f'Failed to cleanup MinIO: {cleanup_error}',
                        )
                    raise ValueError(
                        f"Failed to create document: {doc_result.message}",
                    )

                logger.info(
                    f'Created document {doc_result.document_id} for file {file.filename}',
                    extra={
                        'document_id': str(doc_result.document_id),
                        'file_name': file.filename,
                    },
                )

                return {
                    'success': True,
                    'document_id': str(doc_result.document_id),
                    'file_name': file.filename,
                    'display_name': file_stem,
                    'file_url': file_url,
                    'file_size': file_data['size'],
                    'status': 'draft',  # Draft status - waiting for batch-process to commit
                }

            except Exception as e:
                logger.error(f'Failed to upload file {file.filename}: {e}')
                return {
                    'success': False,
                    'error': 'upload_failed',
                    'message': f'Failed to upload file "{file.filename}": {str(e)}',
                    'file_index': idx,
                    'file_name': file.filename,
                    'exception': str(e),
                }

        # Upload all files IN PARALLEL using asyncio.gather
        logger.info(
            f'Uploading {len(files_data)} files to MinIO in parallel...',
        )
        upload_results = await asyncio.gather(
            *[
                upload_single_file(idx, file_data)
                for idx, file_data in enumerate(files_data)
            ],
            return_exceptions=True,  # Don't fail entire batch on single error
        )

        # Check for any errors and collect successful documents
        documents_info = []
        failed_uploads = []

        for idx, result in enumerate(upload_results):
            if isinstance(result, Exception):
                logger.error(f"Upload exception for file {idx}: {result}")
                failed_uploads.append({
                    'file_index': idx,
                    'error': str(result),
                })
            elif isinstance(result, dict) and not result.get('success'):
                logger.error(
                    f"Upload failed for file {idx}: {result.get('message')}",
                )
                failed_uploads.append(result)
            elif isinstance(result, dict):
                documents_info.append(result)

        if failed_uploads:
            # If any uploads failed, return error with details
            logger.error(
                f'{len(failed_uploads)} uploads failed out of {len(files_data)}',
            )
            return {
                'success': False,
                'message': f'{len(failed_uploads)} uploads failed',
                'failed_uploads': failed_uploads,
            }

        logger.info(
            f'Successfully uploaded {len(documents_info)} files to MinIO',
        )

        return {
            'success': True,
            'documents_info': documents_info,
        }
