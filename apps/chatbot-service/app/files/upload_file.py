from __future__ import annotations

import os
import tempfile
import uuid
from typing import List

from domain.db_service import CreatingFileAttachmentInput
from domain.db_service import CreatingFileAttachmentService
from domain.document_processor import ALLOWED_EXTENSIONS
from domain.document_processor import FileProcessingInput
from domain.document_processor import FileProcessingService
from domain.document_processor import MAX_FILE_SIZE_BYTES
from domain.document_processor import MAX_FILES_PER_UPLOAD
from fastapi import UploadFile
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.minio_storage.minio_service import get_minio_service
from joint.settings.settings import PostgresSettings
from joint.utils import get_settings
from pydantic import Field

logger = get_logger(__name__)


class FileUploadResult(BaseModel):
    """Single file upload result returned to frontend."""
    file_id: uuid.UUID
    file_name: str
    file_type: str
    file_size: int
    storage_url: str
    processing_status: str


class FileUploadInput(BaseModel):
    """Input model for file upload service."""
    files: List[UploadFile]
    user_id: uuid.UUID


class FileUploadOutput(BaseModel):
    """Output model for file upload service."""
    success: bool
    message: str = ''
    results: List[FileUploadResult] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class FileUploadService(BaseService):
    """App service for handling file uploads."""

    postgres_settings: PostgresSettings

    async def process(self, inputs: FileUploadInput, db_session=None) -> FileUploadOutput:
        """
        Process file upload request.

        Args:
            inputs: FileUploadInput with files and user_id
            db_session: Optional database session

        Returns:
            FileUploadOutput with upload results
        """
        settings = get_settings()
        
        try:
            # Initialize services
            file_processing_service = FileProcessingService(settings=settings)
            creating_file_attachment_service = CreatingFileAttachmentService(
                settings=settings.postgres,
            )
            minio_service = get_minio_service(settings=settings)

            # Validate file count
            if not inputs.files:
                return FileUploadOutput(
                    success=False,
                    message='At least one file is required',
                )

            if len(inputs.files) > MAX_FILES_PER_UPLOAD:
                return FileUploadOutput(
                    success=False,
                    message=f'Maximum {MAX_FILES_PER_UPLOAD} files allowed per upload',
                )

            results: List[FileUploadResult] = []
            errors: List[str] = []

            # Process each file
            for upload_file in inputs.files:
                try:
                    result = await self._process_single_file(
                        upload_file=upload_file,
                        user_id=inputs.user_id,
                        db_session=db_session,
                        file_processing_service=file_processing_service,
                        creating_file_attachment_service=creating_file_attachment_service,
                        minio_service=minio_service,
                        settings=settings,
                    )
                    
                    if result:
                        results.append(result)
                    
                except Exception as e:
                    logger.error(
                        f'Unexpected error processing {upload_file.filename}: {str(e)}',
                        exc_info=True,
                    )
                    errors.append(f'{upload_file.filename}: Processing failed')

            # Determine overall success
            if not results and errors:
                return FileUploadOutput(
                    success=False,
                    message='All files failed to upload',
                    errors=errors,
                )

            logger.info(
                f'File upload completed - {len(results)} succeeded, {len(errors)} failed',
            )

            return FileUploadOutput(
                success=True,
                message=f'Uploaded {len(results)} file(s) successfully',
                results=results,
                errors=errors,
            )

        except Exception as e:
            logger.error(f'File upload service error: {str(e)}', exc_info=True)
            return FileUploadOutput(
                success=False,
                message=f'File upload service error: {str(e)}',
            )

    async def _process_single_file(
        self,
        upload_file: UploadFile,
        user_id: uuid.UUID,
        db_session,
        file_processing_service: FileProcessingService,
        creating_file_attachment_service: CreatingFileAttachmentService,
        minio_service,
        settings,
    ) -> FileUploadResult | None:
        """Process a single file: validate, store, extract content, save to DB.

        Returns:
            FileUploadResult if successful, None if failed (error logged).
        """
        file_name = upload_file.filename or 'unknown'
        ext = os.path.splitext(file_name)[1].lower()

        # Validate extension
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f'Unsupported file type ({ext}). '
                f'Allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))}',
            )

        # Read file content
        file_bytes = await upload_file.read()
        file_size = len(file_bytes)

        # Validate size
        if file_size > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise ValueError(f'File too large ({file_size} bytes). Max: {max_mb}MB')

        if file_size == 0:
            raise ValueError('File is empty')

        # Generate unique storage path
        file_id = uuid.uuid4()
        storage_path = f'{user_id}/{file_id}{ext}'
        bucket_name = settings.minio.attachment_bucket_name

        tmp_path = None
        try:
            # Upload to MinIO
            minio_service.ensure_bucket_exists(bucket_name)
            content_type = upload_file.content_type or 'application/octet-stream'
            future = minio_service.upload_bytes(
                bucket_name=bucket_name,
                object_name=storage_path,
                data=file_bytes,
                content_type=content_type,
            )
            future.result(timeout=30)

            logger.info(f'Uploaded {file_name} to MinIO: {bucket_name}/{storage_path}')

            # Extract content using FileProcessingService
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            processing_input = FileProcessingInput(
                file_path=tmp_path,
                file_name=file_name,
            )
            processing_result = await file_processing_service.process(processing_input)
            extracted_content = processing_result.extracted_content

            logger.info(
                f'Extracted content from {file_name} '
                f'(method: {processing_result.processing_method}, '
                f'length: {len(extracted_content)})',
            )

            # Save to database
            public_url = f'{settings.minio.public_url_base}/{bucket_name}/{storage_path}'

            attachment_input = CreatingFileAttachmentInput(
                user_id=user_id,
                file_name=file_name,
                file_type=ext.lstrip('.'),
                file_size=file_size,
                storage_path=public_url,
                extracted_content=extracted_content,
                processing_status='completed',
            )
            db_result = creating_file_attachment_service.process(attachment_input, db_session)

            if not db_result.status or not db_result.attachment_id:
                raise ValueError(f'Failed to save metadata - {db_result.message}')

            logger.info(f'File attachment saved: {db_result.attachment_id} for user {user_id}')

            return FileUploadResult(
                file_id=db_result.attachment_id,
                file_name=file_name,
                file_type=ext.lstrip('.'),
                file_size=file_size,
                storage_url=public_url,
                processing_status='completed',
            )

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)