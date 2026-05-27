from __future__ import annotations

import io
import os
import time
from concurrent.futures import Future
from typing import Optional

from joint.logging.logger import get_logger
from minio.error import S3Error
from pydantic import BaseModel
from pydantic import field_validator

from .client import MinIOClient

logger = get_logger(__name__)


class MinIOError(Exception):
    """Custom exception for MinIO operations."""
    pass


class MinIOInput(BaseModel):
    """Input model for MinIO file operations"""
    bucket_name: str
    object_name: str
    file_path: Optional[str] = None
    data: Optional[bytes] = None  # For direct bytes upload
    content_type: Optional[str] = None  # MIME type

    @field_validator('bucket_name')
    @classmethod
    def validate_bucket_name(cls, v: str) -> str:
        """Validate bucket name according to S3 standards."""
        if not v or len(v) < 3 or len(v) > 63:
            raise ValueError('Bucket name must be between 3 and 63 characters')
        if not v.replace('-', '').replace('.', '').isalnum():
            raise ValueError(
                'Bucket name can only contain letters, numbers, hyphens, and dots',
            )
        return v.lower()

    @field_validator('object_name')
    @classmethod
    def validate_object_name(cls, v: str) -> str:
        """Validate object name."""
        if not v or len(v) > 1024:
            raise ValueError(
                'Object name must be between 1 and 1024 characters',
            )
        return v

    def model_post_init(self, __context) -> None:
        """Validate that either file_path or data is provided"""
        if not self.file_path and not self.data:
            raise ValueError('Either file_path or data must be provided')
        if self.file_path and self.data:
            raise ValueError('Cannot provide both file_path and data')
        if self.file_path and not os.path.exists(self.file_path):
            raise ValueError(f"File does not exist: {self.file_path}")


class MinioFileProcessor(MinIOClient):
    """Handles file upload/download operations for MinIO"""

    def _retry_operation(self, operation, max_retries: int = 3, backoff_factor: float = 0.5):
        """Retry mechanism with exponential backoff."""
        last_exception = None
        for attempt in range(max_retries):
            try:
                return operation()
            except S3Error as e:
                last_exception = e
                if attempt < max_retries - 1:
                    wait_time = backoff_factor * (2 ** attempt)
                    logger.warning(
                        f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {e}",
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(f"All {max_retries} attempts failed: {e}")
        raise MinIOError(
            f"Operation failed after {max_retries} retries",
        ) from last_exception

    def _ensure_bucket_exists(self, bucket_name: str) -> bool:
        """Ensure bucket exists, create if it doesn't."""
        def _check_and_create():
            if not self.minio_client.bucket_exists(bucket_name):
                self.minio_client.make_bucket(bucket_name)
                logger.info(f"Created bucket: {bucket_name}")
            return True

        return self._retry_operation(_check_and_create)

    def _detect_content_type(self, file_path: str) -> str:
        """Detect content type from file extension."""
        content_types = {
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.csv': 'text/csv',
            '.mp4': 'video/mp4',
            '.zip': 'application/zip',
        }

        ext = os.path.splitext(file_path.lower())[1]
        return content_types.get(ext, 'application/octet-stream')

    def upload_file(
        self,
        bucket_name: str,
        object_name: str,
        file_path: str,
        content_type: Optional[str] = None,
    ) -> Future:
        """Upload a file to MinIO asynchronously.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.
            file_path (str): Path to the local file.
            content_type (Optional[str]): MIME type of the file.

        Returns:
            Future: Future object representing the asynchronous upload task.
        """
        def _upload_file_with_retry():
            # Ensure bucket exists
            self._ensure_bucket_exists(bucket_name)

            # Detect content type if not provided
            final_content_type = content_type or self._detect_content_type(
                file_path,
            )

            logger.info(
                f"Uploading file {file_path} to {bucket_name}/{object_name}",
            )

            return self._retry_operation(
                lambda: self.minio_client.fput_object(
                    bucket_name,
                    object_name,
                    file_path,
                    content_type=final_content_type,
                ),
            )

        return self.executor.submit(_upload_file_with_retry)

    def upload_bytes(
        self,
        bucket_name: str,
        object_name: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> Future:
        """Upload bytes data to MinIO asynchronously.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.
            data (bytes): The data to upload.
            content_type (Optional[str]): MIME type of the data.

        Returns:
            Future: Future object representing the asynchronous upload task.
        """
        def _upload_bytes_with_retry():
            # Ensure bucket exists
            self._ensure_bucket_exists(bucket_name)

            data_stream = io.BytesIO(data)
            final_content_type = content_type or self._detect_content_type(
                object_name,
            )

            logger.info(
                f"Uploading {len(data)} bytes to {bucket_name}/{object_name}",
            )

            return self._retry_operation(
                lambda: self.minio_client.put_object(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    data=data_stream,
                    length=len(data),
                    content_type=final_content_type,
                ),
            )

        return self.executor.submit(_upload_bytes_with_retry)

    def download_file(
        self,
        bucket_name: str,
        object_name: str,
        file_path: str,
    ) -> Future:
        """Download a file from MinIO asynchronously.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.
            file_path (str): Path where the file will be saved.

        Returns:
            Future: Future object representing the asynchronous download task.
        """
        def _download_with_retry():
            logger.info(
                f"Downloading {bucket_name}/{object_name} to {file_path}",
            )

            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            return self._retry_operation(
                lambda: self.minio_client.fget_object(
                    bucket_name,
                    object_name,
                    file_path,
                ),
            )

        return self.executor.submit(_download_with_retry)

    def download_bytes(self, bucket_name: str, object_name: str) -> Future[bytes]:
        """Download object data directly to memory.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.

        Returns:
            Future[bytes]: Future containing the object data.
        """
        def _download_data():
            logger.info(f"Downloading {bucket_name}/{object_name} to memory")

            response = self._retry_operation(
                lambda: self.minio_client.get_object(bucket_name, object_name),
            )
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()

        return self.executor.submit(_download_data)

    # Legacy methods using MinIOInput for backward compatibility
    def put_object(self, input_data: MinIOInput) -> Future:
        """Upload an object using MinIOInput (legacy method)."""
        if input_data.data:
            return self.upload_bytes(
                input_data.bucket_name,
                input_data.object_name,
                input_data.data,
                input_data.content_type,
            )
        elif input_data.file_path:
            return self.upload_file(
                input_data.bucket_name,
                input_data.object_name,
                input_data.file_path,
                input_data.content_type,
            )
        else:
            raise ValueError('Either file_path or data must be provided')

    def get_object(self, input_data: MinIOInput) -> Future:
        """Download an object using MinIOInput (legacy method)."""
        if not input_data.file_path:
            raise ValueError('file_path required for download')

        return self.download_file(
            input_data.bucket_name,
            input_data.object_name,
            input_data.file_path,
        )

    def get_object_data(self, input_data: MinIOInput) -> Future[bytes]:
        """Download object data using MinIOInput (legacy method)."""
        return self.download_bytes(input_data.bucket_name, input_data.object_name)
