"""
Batch Document Processing Service (Step 2 - Process with Metadata)

This module handles triggering processing for multiple uploaded documents.
Documents must be uploaded first via BatchUploadOnlyService.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import List
from typing import Optional
from uuid import UUID

from app.documents.background_processor import DocumentBackgroundProcessor
from domain.db_service.document_services import BatchUpdatingDocumentInput
from domain.db_service.document_services import BatchUpdatingDocumentService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings import Settings

logger = get_logger(__name__)

# Global semaphore to limit concurrent document processing
# This prevents overloading the system when processing multiple heavy documents
# (especially with LLM Vision API calls which are resource-intensive)
#
# MEMORY CALCULATION (with 20GB RAM):
# - Per document: ~500-800MB (average)
# - System overhead: ~500MB
# - Concurrent 6: ~3.6GB + 500MB = ~4.1GB (20% RAM usage) ✅ SAFE
# - Concurrent 8: ~4.8GB + 500MB = ~5.3GB (26% RAM usage) ✅ OPTIMAL
#
# RECOMMENDATIONS:
# - Server 20GB RAM: MAX_CONCURRENT = 6-8 (current optimal)
# - Server 8-16GB RAM: MAX_CONCURRENT = 3-5
# - Server 4-8GB RAM: MAX_CONCURRENT = 2-3
# - Adjust based on actual file sizes and monitoring
MAX_CONCURRENT_PROCESSING = 6  # Optimized for 20GB RAM server (was 3)
_processing_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSING)

# Monitoring: Track processing statistics
_processing_stats = {
    'total_started': 0,
    'total_completed': 0,
    'total_failed': 0,
    'current_processing': 0,
    'peak_memory_mb': 0,  # Track peak memory usage
    'avg_processing_time': 0,  # Average time per document
}

# Memory thresholds for adaptive concurrency (optional)
MEMORY_WARNING_THRESHOLD = 0.7  # 70% of total RAM
MEMORY_CRITICAL_THRESHOLD = 0.85  # 85% of total RAM


def get_memory_usage() -> dict:
    """
    Get current memory usage statistics.

    Returns:
        Dict with memory info (total, used, percent, available)
    """
    try:
        import psutil
        memory = psutil.virtual_memory()
        return {
            'total_gb': round(memory.total / (1024**3), 2),
            'used_gb': round(memory.used / (1024**3), 2),
            'percent': memory.percent,
            'available_gb': round(memory.available / (1024**3), 2),
        }
    except ImportError:
        # psutil not installed - return dummy data
        logger.warning('psutil not installed - memory monitoring disabled')
        return {
            'total_gb': 20.0,
            'used_gb': 0.0,
            'percent': 0.0,
            'available_gb': 20.0,
        }
    except Exception as e:
        logger.error(f"Failed to get memory usage: {e}")
        return {
            'total_gb': 20.0,
            'used_gb': 0.0,
            'percent': 0.0,
            'available_gb': 20.0,
        }


class BatchProcessDocumentInput(BaseModel):
    """Input model for batch processing documents with shared metadata"""
    document_ids: List[UUID]

    # Shared metadata to apply to all documents
    processing_type: str
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    issuing_unit: Optional[str] = None
    access_scope: Optional[str] = None
    version: Optional[str] = None


class BatchProcessDocumentOutput(BaseModel):
    """Output model for successful batch document processing trigger"""
    message: str
    document_ids: List[str]
    processing_status: str
    total_count: int


class BatchProcessDocumentService(BaseService):
    """
    Application service to handle batch document processing trigger (Step 2 of 2-step flow).

    This service:
    1. Updates metadata for all documents (bulk operation)
    2. Triggers background processing for each document (parallel)
    3. Returns immediately with 202 Accepted

    Documents must already be uploaded via BatchUploadOnlyService.
    """

    settings: Settings

    @property
    def batch_updating_document_service(self) -> BatchUpdatingDocumentService:
        return BatchUpdatingDocumentService(settings=self.settings.postgres)

    @property
    def background_processor(self) -> DocumentBackgroundProcessor:
        return DocumentBackgroundProcessor(settings=self.settings)

    async def process(self, inputs: BatchProcessDocumentInput, db_session=None) -> BatchProcessDocumentOutput:
        """
        Trigger batch document processing in background.

        This is Step 2 of 2-step document processing:
        1. Bulk update document metadata (processing_type, dates, etc.) for all documents
        2. Trigger background processing for each document in parallel
        3. Return immediately with 202 Accepted

        Args:
            inputs: BatchProcessDocumentInput with document_ids and shared metadata
            db_session: Database session

        Returns:
            BatchProcessDocumentOutput with success message

        Raises:
            Exception: If documents not found or processing trigger fails
        """
        try:
            total_count = len(inputs.document_ids)
            logger.info(
                f"Starting batch processing for {total_count} documents",
            )

            # Step 1: Bulk update document metadata (optimized single query)
            # Change status from 'draft' -> 'pending' and set processing_type + metadata
            update_input = BatchUpdatingDocumentInput(
                document_ids=inputs.document_ids,
                processing_type=inputs.processing_type,
                processing_status='pending',  # Commit: draft -> pending
                effective_from=inputs.effective_from,
                effective_to=inputs.effective_to,
                issuing_unit=inputs.issuing_unit,
                access_scope=inputs.access_scope,
                version=inputs.version,
            )

            update_result = await self.batch_updating_document_service.process(update_input, db_session)

            if not update_result.status:
                raise Exception(
                    f"Failed to update document metadata: {update_result.message}",
                )

            logger.info(
                f"Batch metadata updated for {update_result.successful_count}/{total_count} documents",
            )

            # Step 2: Trigger background processing for each document IN PARALLEL
            # With Semaphore to limit concurrent processing (max 3 at a time)
            # This prevents overloading system resources (CPU, memory, API rate limits)
            for document_id in inputs.document_ids:
                asyncio.create_task(
                    self._process_with_semaphore(document_id),
                )

            logger.info(
                f"Background processing triggered for {total_count} documents "
                f"(max {MAX_CONCURRENT_PROCESSING} concurrent)",
            )

            return BatchProcessDocumentOutput(
                message=f"Batch processing started for {total_count} documents",
                document_ids=[str(doc_id) for doc_id in inputs.document_ids],
                processing_status='processing',
                total_count=total_count,
            )

        except Exception as e:
            logger.error(f"Failed to process batch documents: {str(e)}")
            raise Exception(f"Batch processing failed: {str(e)}")

    async def _process_with_semaphore(self, document_id: UUID):
        """
        Process document with semaphore to limit concurrency.

        This wrapper ensures that only MAX_CONCURRENT_PROCESSING documents
        are processed at the same time, preventing system overload.

        Args:
            document_id: UUID of document to process
        """
        _processing_stats['total_started'] += 1
        _processing_stats['current_processing'] += 1

        async with _processing_semaphore:
            slots_in_use = MAX_CONCURRENT_PROCESSING - _processing_semaphore._value

            # Get current memory usage
            mem_info = get_memory_usage()
            mem_percent = mem_info['percent']

            # Log with memory info
            logger.info(
                f"Document {document_id}: Acquired processing slot "
                f"({slots_in_use}/{MAX_CONCURRENT_PROCESSING} in use, "
                f"RAM: {mem_info['used_gb']:.1f}/{mem_info['total_gb']:.1f}GB ({mem_percent:.1f}%), "
                f"stats: {_processing_stats['total_completed']} completed, "
                f"{_processing_stats['total_failed']} failed)",
            )

            # Warning if memory usage is high
            if mem_percent > MEMORY_WARNING_THRESHOLD * 100:
                logger.warning(
                    f"⚠️  HIGH MEMORY USAGE: {mem_percent:.1f}% "
                    f"(threshold: {MEMORY_WARNING_THRESHOLD*100}%). "
                    f"Consider reducing MAX_CONCURRENT_PROCESSING if issues occur.",
                )

            import time
            start_time = time.time()

            try:
                await self.background_processor.process_document(
                    document_id=document_id,
                    db_session=None,  # Each task gets its own session
                )

                # Calculate processing time
                processing_time = time.time() - start_time

                _processing_stats['total_completed'] += 1
                logger.info(
                    f"Document {document_id}: Processing completed successfully "
                    f"(took {processing_time:.1f}s)",
                )

            except Exception as e:
                _processing_stats['total_failed'] += 1
                logger.error(
                    f"Document {document_id}: Processing failed: {str(e)}",
                    extra={
                        'error_type': type(e).__name__,
                        'error_message': str(e),
                    },
                )
                # Don't re-raise - other documents should continue processing

            finally:
                _processing_stats['current_processing'] -= 1
                slots_remaining = MAX_CONCURRENT_PROCESSING - _processing_semaphore._value - 1

                # Get final memory usage
                final_mem = get_memory_usage()

                # Track peak memory
                if final_mem['used_gb'] * 1024 > _processing_stats['peak_memory_mb']:
                    _processing_stats['peak_memory_mb'] = final_mem['used_gb'] * 1024

                logger.info(
                    f"Document {document_id}: Released processing slot "
                    f"({slots_remaining} remaining, {_processing_stats['current_processing']} still processing, "
                    f"RAM: {final_mem['used_gb']:.1f}GB)",
                )
