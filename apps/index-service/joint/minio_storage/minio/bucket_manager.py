from __future__ import annotations

import time
from typing import List

from joint.logging.logger import get_logger
from minio.datatypes import Bucket
from minio.error import S3Error

from .client import MinIOClient

logger = get_logger(__name__)


class MinIOError(Exception):
    """Custom exception for MinIO operations."""
    pass


class MinioBucketManager(MinIOClient):
    """Handles bucket management operations for MinIO"""

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

    def ensure_bucket_exists(self, bucket_name: str) -> bool:
        """Ensure bucket exists, create if it doesn't.

        Args:
            bucket_name (str): Name of the bucket to check/create.

        Returns:
            bool: True if bucket exists or was created successfully.
        """
        def _check_and_create():
            if not self.minio_client.bucket_exists(bucket_name):
                self.minio_client.make_bucket(bucket_name)
                logger.info(f"Created bucket: {bucket_name}")
                return True
            logger.info(f"Bucket already exists: {bucket_name}")
            return True

        try:
            return self._retry_operation(_check_and_create)
        except Exception as e:
            logger.error(f"Failed to ensure bucket exists: {e}")
            raise MinIOError(f"Failed to ensure bucket exists: {e}") from e

    def list_buckets(self) -> List[Bucket]:
        """List all buckets in the MinIO server with retry mechanism.

        Returns:
            List[Bucket]: List of buckets.

        Raises:
            MinIOError: If the operation fails after retries.
        """
        try:
            logger.debug('Listing all buckets')
            result = self._retry_operation(
                lambda: list(self.minio_client.list_buckets()),
            )
            logger.info(f"Successfully listed {len(result)} buckets")
            return result
        except Exception as e:
            logger.error(f"Failed to list buckets: {e}")
            raise MinIOError(f"Failed to list buckets: {e}") from e

    def delete_bucket(self, bucket_name: str, force: bool = False) -> bool:
        """Delete a bucket.

        Args:
            bucket_name (str): Name of the bucket to delete.
            force (bool): If True, delete all objects in bucket first.

        Returns:
            bool: True if deletion was successful.

        Raises:
            MinIOError: If the deletion operation fails after retries.
        """
        def _delete_bucket():
            if force:
                # Delete all objects first
                objects = self.minio_client.list_objects(
                    bucket_name, recursive=True,
                )
                for obj in objects:
                    self.minio_client.remove_object(
                        bucket_name, obj.object_name,
                    )
                    logger.debug(f"Deleted object: {obj.object_name}")

            self.minio_client.remove_bucket(bucket_name)
            return True

        try:
            logger.info(f"Deleting bucket: {bucket_name} (force={force})")
            result = self._retry_operation(_delete_bucket)
            logger.info(f"Successfully deleted bucket: {bucket_name}")
            return result
        except Exception as e:
            logger.error(f"Failed to delete bucket {bucket_name}: {e}")
            raise MinIOError(
                f"Failed to delete bucket {bucket_name}: {e}",
            ) from e

    def bucket_exists(self, bucket_name: str) -> bool:
        """Check if a bucket exists.

        Args:
            bucket_name (str): Name of the bucket to check.

        Returns:
            bool: True if bucket exists, False otherwise.
        """
        try:
            logger.debug(f"Checking if bucket exists: {bucket_name}")
            result = self._retry_operation(
                lambda: self.minio_client.bucket_exists(bucket_name),
            )
            logger.debug(f"Bucket {bucket_name} exists: {result}")
            return result
        except Exception as e:
            logger.error(f"Failed to check bucket existence: {e}")
            raise MinIOError(f"Failed to check bucket existence: {e}") from e

    def get_bucket_info(self, bucket_name: str) -> dict:
        """Get information about a bucket.

        Args:
            bucket_name (str): Name of the bucket.

        Returns:
            dict: Bucket information including object count and total size.
        """
        try:
            logger.debug(f"Getting bucket info: {bucket_name}")

            if not self.bucket_exists(bucket_name):
                raise MinIOError(f"Bucket {bucket_name} does not exist")

            objects = list(
                self.minio_client.list_objects(
                    bucket_name, recursive=True,
                ),
            )
            total_size = sum(obj.size for obj in objects if obj.size)

            info = {
                'name': bucket_name,
                'object_count': len(objects),
                'total_size': total_size,
                'exists': True,
            }

            logger.info(f"Bucket info for {bucket_name}: {info}")
            return info
        except Exception as e:
            logger.error(f"Failed to get bucket info: {e}")
            raise MinIOError(f"Failed to get bucket info: {e}") from e
