from __future__ import annotations

import os
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import urllib3
from joint.base import BaseModel
from joint.logging.logger import get_logger
from joint.settings.settings import Settings
from minio import Minio  # type: ignore

logger = get_logger(__name__)


class MinIOClient(BaseModel):
    """Base MinIO client for handling connections and basic operations"""

    settings: Settings

    # Private attributes
    _minio_client: Optional[Minio] = None
    _executor: Optional[ThreadPoolExecutor] = None
    _http_client: Optional[urllib3.PoolManager] = None

    @property
    def http_client(self) -> urllib3.PoolManager:
        """Reusable HTTP client with connection pooling."""
        if self._http_client is None:
            self._http_client = urllib3.PoolManager(
                cert_reqs='NONE' if not self.settings.minio.ssl else 'CERT_REQUIRED',
                maxsize=20,  # Increased pool size
                block=True,
                retries=urllib3.Retry(
                    total=3,
                    backoff_factor=0.3,
                    status_forcelist=[500, 502, 503, 504],
                ),
            )
        return self._http_client

    @property
    def minio_client(self) -> Minio:
        """MinIO client instance configured with settings and optimizations.

        Returns:
            Minio: Configured MinIO client instance.
        """
        if self._minio_client is None:
            client = Minio(
                self.settings.minio.host,
                access_key=self.settings.minio.username,
                secret_key=self.settings.minio.password,
                secure=self.settings.minio.ssl,
                http_client=self.http_client,
            )
            if self.settings.minio.debug:
                client.trace_on(sys.stderr)
            self._minio_client = client
        return self._minio_client

    @property
    def executor(self) -> ThreadPoolExecutor:
        """Thread pool executor for async operations."""
        if self._executor is None:
            # Dynamic thread count based on CPU cores
            max_workers = min(32, (os.cpu_count() or 1) + 4)
            self._executor = ThreadPoolExecutor(
                max_workers=max_workers,
                thread_name_prefix='minio_worker',
            )
        return self._executor

    def __del__(self) -> None:
        """Clean up resources by shutting down pools and executors."""
        if hasattr(self, '_executor') and self._executor is not None:
            self._executor.shutdown(wait=True)
        if hasattr(self, '_http_client') and self._http_client is not None:
            self._http_client.clear()

    def get_client_info(self) -> dict:
        """Get MinIO client configuration information."""
        try:
            return {
                'host': self.settings.minio.host,
                'ssl': self.settings.minio.ssl,
                'debug': self.settings.minio.debug,
                'connected': True if self._minio_client else False,
            }
        except Exception as e:
            logger.error(f"Failed to get client info: {e}")
            return {'connected': False, 'error': str(e)}
