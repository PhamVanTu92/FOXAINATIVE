from __future__ import annotations

from concurrent.futures import Future
from typing import Optional

from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings

from .minio.bucket_manager import MinioBucketManager
from .minio.client import MinIOClient
from .minio.file_processor import MinioFileProcessor
from .minio.object_manager import MinioObjectManager

logger = get_logger(__name__)


# Module-level singleton instance
_minio_instance: Optional[MinioService] = None


def get_minio_service(settings: Settings) -> MinioService:
    """Get singleton MinioService instance.

    Uses module-level singleton pattern to reuse MinIO client and thread pool
    executor across the application.

    Args:
        settings: Application settings.

    Returns:
        Singleton MinioService instance.
    """
    global _minio_instance
    if _minio_instance is None:
        logger.info('Initializing singleton MinioService instance')
        _minio_instance = MinioService(settings=settings)
    return _minio_instance


class MinioService(BaseModel):
    """
    Main MinIO service that orchestrates all MinIO operations.
    This is a facade that delegates to specialized components.
    """

    settings: Settings

    # Private attributes for caching
    _client = None
    _bucket_manager = None
    _object_manager = None
    _file_processor = None

    @property
    def client(self) -> MinIOClient:
        """Lazy loading client with caching"""
        if self._client is None:
            self._client = MinIOClient(settings=self.settings)
        return self._client

    @property
    def bucket_manager(self) -> MinioBucketManager:
        """Lazy loading bucket manager with caching"""
        if self._bucket_manager is None:
            self._bucket_manager = MinioBucketManager(settings=self.settings)
        return self._bucket_manager

    @property
    def object_manager(self) -> MinioObjectManager:
        """Lazy loading object manager with caching"""
        if self._object_manager is None:
            self._object_manager = MinioObjectManager(settings=self.settings)
        return self._object_manager

    @property
    def file_processor(self) -> MinioFileProcessor:
        """Lazy loading file processor with caching"""
        if self._file_processor is None:
            self._file_processor = MinioFileProcessor(settings=self.settings)
        return self._file_processor

    # Delegate client operations
    def get_minio_client(self):
        """Get MinIO client instance."""
        return self.client.minio_client

    # Delegate bucket management operations
    def ensure_bucket_exists(self, bucket_name: str) -> bool:
        """Ensure bucket exists, create if it doesn't."""
        return self.bucket_manager.ensure_bucket_exists(bucket_name)

    def list_buckets(self):
        """List all buckets in the MinIO server."""
        return self.bucket_manager.list_buckets()

    def delete_bucket(self, bucket_name: str) -> bool:
        """Delete a bucket."""
        return self.bucket_manager.delete_bucket(bucket_name)

    # Delegate object management operations
    def list_objects(self, bucket_name: str, prefix: Optional[str] = None, recursive: bool = True):
        """List objects in a specified bucket."""
        return self.object_manager.list_objects(bucket_name, prefix, recursive)

    def object_exists(self, bucket_name: str, object_name: str) -> bool:
        """Check if an object exists in a bucket."""
        return self.object_manager.object_exists(bucket_name, object_name)

    def delete_object(self, bucket_name: str, object_name: str) -> bool:
        """Delete an object from a bucket."""
        return self.object_manager.delete_object(bucket_name, object_name)

    def get_object_info(self, bucket_name: str, object_name: str) -> dict:
        """Get detailed information about an object."""
        return self.object_manager.get_object_info(bucket_name, object_name)

    # Delegate file processing operations
    def upload_file(self, bucket_name: str, object_name: str, file_path: str, content_type: Optional[str] = None) -> Future:
        """Upload a file to MinIO."""
        return self.file_processor.upload_file(bucket_name, object_name, file_path, content_type)

    def upload_bytes(self, bucket_name: str, object_name: str, data: bytes, content_type: Optional[str] = None) -> Future:
        """Upload bytes data to MinIO."""
        return self.file_processor.upload_bytes(bucket_name, object_name, data, content_type)

    def download_file(self, bucket_name: str, object_name: str, file_path: str) -> Future:
        """Download a file from MinIO."""
        return self.file_processor.download_file(bucket_name, object_name, file_path)

    def download_bytes(self, bucket_name: str, object_name: str) -> Future[bytes]:
        """Download object data directly to memory."""
        return self.file_processor.download_bytes(bucket_name, object_name)

    # Backward compatibility properties
    @property
    def minio_client(self):
        """Get MinIO client for backward compatibility."""
        return self.client.minio_client

    @property
    def executor(self):
        """Get thread pool executor for backward compatibility."""
        return self.client.executor
