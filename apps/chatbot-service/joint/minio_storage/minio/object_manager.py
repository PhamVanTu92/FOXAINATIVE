from __future__ import annotations

import time
from typing import List
from typing import Optional

from joint.logging.logger import get_logger
from minio.datatypes import Object
from minio.error import S3Error

from .client import MinIOClient

logger = get_logger(__name__)


class MinIOError(Exception):
    """Custom exception for MinIO operations."""
    pass


class MinioObjectManager(MinIOClient):
    """Handles object management operations for MinIO"""

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

    def list_objects(
        self,
        bucket_name: str,
        prefix: Optional[str] = None,
        recursive: bool = True,
    ) -> List[Object]:
        """List objects in a specified bucket with improved filtering.

        Args:
            bucket_name (str): Name of the bucket.
            prefix (Optional[str]): Prefix to filter objects (default: None).
            recursive (bool): Whether to list recursively (default: True).

        Returns:
            List[Object]: List of objects.

        Raises:
            MinIOError: If the operation fails after retries.
        """
        def _list_objects():
            return list(
                self.minio_client.list_objects(
                    bucket_name,
                    prefix=prefix,
                    recursive=recursive,
                ),
            )

        try:
            logger.debug(
                f"Listing objects in bucket: {bucket_name}, prefix: {prefix}",
            )
            result = self._retry_operation(_list_objects)
            logger.info(
                f"Successfully listed {len(result)} objects from bucket {bucket_name}",
            )
            return result
        except Exception as e:
            logger.error(f"Failed to list objects: {e}")
            raise MinIOError(f"Failed to list objects: {e}") from e

    def object_exists(self, bucket_name: str, object_name: str) -> bool:
        """Check if an object exists in a bucket.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.

        Returns:
            bool: True if object exists, False otherwise.
        """
        def _check_exists():
            try:
                self.minio_client.stat_object(bucket_name, object_name)
                return True
            except S3Error as e:
                if e.code == 'NoSuchKey':
                    return False
                raise

        try:
            logger.debug(
                f"Checking if object exists: {bucket_name}/{object_name}",
            )
            result = self._retry_operation(_check_exists)
            logger.debug(
                f"Object {bucket_name}/{object_name} exists: {result}",
            )
            return result
        except Exception as e:
            logger.error(f"Failed to check object existence: {e}")
            raise MinIOError(f"Failed to check object existence: {e}") from e

    def delete_object(self, bucket_name: str, object_name: str) -> bool:
        """Delete an object from a bucket with retry mechanism.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.

        Returns:
            bool: True if deletion was successful.

        Raises:
            MinIOError: If the deletion operation fails after retries.
        """
        def _delete_with_retry():
            self.minio_client.remove_object(bucket_name, object_name)
            return True

        try:
            logger.info(f"Deleting object: {bucket_name}/{object_name}")
            result = self._retry_operation(_delete_with_retry)
            logger.info(
                f"Successfully deleted object {object_name} from bucket {bucket_name}",
            )
            return result
        except Exception as e:
            logger.error(f"Failed to delete object: {e}")
            raise MinIOError(f"Failed to delete object: {e}") from e

    def get_object_info(self, bucket_name: str, object_name: str) -> dict:
        """Get detailed information about an object.

        Args:
            bucket_name (str): Name of the bucket.
            object_name (str): Name of the object.

        Returns:
            dict: Object information including size, content type, etc.
        """
        def _get_info():
            stat = self.minio_client.stat_object(bucket_name, object_name)
            return {
                'bucket_name': bucket_name,
                'object_name': object_name,
                'size': stat.size,
                'etag': stat.etag,
                'content_type': stat.content_type,
                'last_modified': stat.last_modified,
                'metadata': stat.metadata,
            }

        try:
            logger.debug(f"Getting object info: {bucket_name}/{object_name}")
            result = self._retry_operation(_get_info)
            logger.info(
                f"Successfully retrieved info for object {bucket_name}/{object_name}",
            )
            return result
        except Exception as e:
            logger.error(f"Failed to get object info: {e}")
            raise MinIOError(f"Failed to get object info: {e}") from e

    def copy_object(
        self,
        source_bucket: str,
        source_object: str,
        dest_bucket: str,
        dest_object: str,
    ) -> bool:
        """Copy an object from one location to another.

        Args:
            source_bucket (str): Source bucket name.
            source_object (str): Source object name.
            dest_bucket (str): Destination bucket name.
            dest_object (str): Destination object name.

        Returns:
            bool: True if copy was successful.
        """
        def _copy_object():
            from minio.datatypes import CopySource
            copy_source = CopySource(source_bucket, source_object)
            self.minio_client.copy_object(
                dest_bucket, dest_object, copy_source,
            )
            return True

        try:
            logger.info(
                f"Copying object from {source_bucket}/{source_object} to {dest_bucket}/{dest_object}",
            )
            result = self._retry_operation(_copy_object)
            logger.info('Successfully copied object')
            return result
        except Exception as e:
            logger.error(f"Failed to copy object: {e}")
            raise MinIOError(f"Failed to copy object: {e}") from e

    def list_objects_with_filter(
        self,
        bucket_name: str,
        prefix: Optional[str] = None,
        suffix: Optional[str] = None,
        max_size: Optional[int] = None,
        min_size: Optional[int] = None,
    ) -> List[Object]:
        """List objects with advanced filtering options.

        Args:
            bucket_name (str): Name of the bucket.
            prefix (Optional[str]): Prefix filter.
            suffix (Optional[str]): Suffix filter.
            max_size (Optional[int]): Maximum file size filter.
            min_size (Optional[int]): Minimum file size filter.

        Returns:
            List[Object]: Filtered list of objects.
        """
        try:
            objects = self.list_objects(bucket_name, prefix, recursive=True)

            filtered_objects = []
            for obj in objects:
                # Apply suffix filter
                if suffix and not obj.object_name.endswith(suffix):
                    continue

                # Apply size filters
                if max_size and obj.size and obj.size > max_size:
                    continue
                if min_size and obj.size and obj.size < min_size:
                    continue

                filtered_objects.append(obj)

            logger.info(
                f"Filtered {len(objects)} objects to {len(filtered_objects)} objects",
            )
            return filtered_objects
        except Exception as e:
            logger.error(f"Failed to filter objects: {e}")
            raise MinIOError(f"Failed to filter objects: {e}") from e
