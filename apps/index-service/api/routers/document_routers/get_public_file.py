"""
Public file endpoint to serve MinIO files without authentication.
This endpoint allows public access to files stored in MinIO for download/display in external systems.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from api.helpers.exception_handler import ExceptionHandler
from api.helpers.exception_handler import ResponseMessage
from fastapi import APIRouter
from fastapi import status
from fastapi.responses import StreamingResponse
from joint.logging import get_logger
from joint.minio_storage import get_minio_service
from joint.utils import get_settings

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    minio_service = get_minio_service(settings)
    logger.info('MinIO service initialized successfully for public file serving')
except Exception as e:
    logger.error(f"Failed to initialize MinIO service: {str(e)}")
    raise RuntimeError(f"MinIO service initialization failed: {str(e)}")


@router.get(
    '/public/files/{bucket_name}/{file_path:path}',
    responses={
        status.HTTP_200_OK: {
            'description': 'File retrieved successfully',
            'content': {
                'application/pdf': {},
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {},
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
                'application/vnd.ms-excel': {},
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': {},
                'text/plain': {},
                'application/octet-stream': {},
            },
        },
        status.HTTP_404_NOT_FOUND: {
            'description': 'File not found',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'File not found',
                    },
                },
            },
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            'description': 'Internal Server Error - Failed to retrieve file',
            'content': {
                'application/json': {
                    'example': {
                        'message': ResponseMessage.INTERNAL_SERVER_ERROR,
                    },
                },
            },
        },
    },
    status_code=status.HTTP_200_OK,
    summary='Get public file from MinIO storage',
    description='Retrieve and serve files from MinIO storage without authentication. For public download/display in external systems.',
)
async def get_public_file(
    bucket_name: str,
    file_path: str,
):
    """
    Retrieve and serve files from MinIO storage without authentication.

    This endpoint serves files stored in MinIO for public access:
    - No authentication required
    - Returns raw file data with appropriate content type
    - Handles various file formats (PDF, DOCX, XLSX, PPTX, TXT, etc.)
    - Designed for external systems and direct file access

    **Security Considerations**:
    - Only serves files from allowed buckets
    - Prevents path traversal attacks
    - Rate limiting should be implemented at reverse proxy level

    **File Processing**:
    - Supports multiple file formats
    - Automatic content type detection
    - Efficient streaming of file data
    - Proper content disposition for download

    **Process Flow**:
    1. Validate bucket and file path parameters
    2. Check security constraints
    3. Retrieve file data from MinIO storage
    4. Detect and set appropriate content type
    5. Return raw file data as response
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Input validation
    if not bucket_name or not bucket_name.strip():
        return exception_handler.handle_bad_request(
            message='Bucket name is required',
            extra={
                'endpoint': 'get_public_file',
                'bucket_name': bucket_name,
            },
        )

    if not file_path or not file_path.strip():
        return exception_handler.handle_bad_request(
            message='File path is required',
            extra={
                'endpoint': 'get_public_file',
                'file_path': file_path,
            },
        )

    # Sanitize inputs
    bucket_name = bucket_name.strip()
    file_path = file_path.strip()

    # Security: Only allow specific buckets for public access
    allowed_buckets = [
        'chatbot-foxai', 'document-images',
        'public-files', 'public-images', 'files-attachment',
    ]
    if bucket_name not in allowed_buckets:
        return exception_handler.handle_bad_request(
            message='Access to this bucket is not allowed',
            extra={
                'endpoint': 'get_public_file',
                'bucket_name': bucket_name,
                'allowed_buckets': allowed_buckets,
            },
        )

    # Security: Prevent path traversal attacks
    if '..' in file_path or file_path.startswith('/'):
        return exception_handler.handle_bad_request(
            message='Invalid file path format',
            extra={
                'endpoint': 'get_public_file',
                'file_path': file_path,
            },
        )

    try:
        logger.info(f'Retrieving public file: {bucket_name}/{file_path}')

        # Check if bucket exists
        if not minio_service.bucket_manager.bucket_exists(bucket_name):
            logger.warning(f'Bucket not found: {bucket_name}')
            return exception_handler.handle_not_found_error(
                message='Bucket not found',
                extra={
                    'endpoint': 'get_public_file',
                    'bucket_name': bucket_name,
                },
            )

        # Check if object exists
        try:
            _ = minio_service.get_object_info(bucket_name, file_path)
        except Exception as e:
            logger.warning(
                f'Public file not found: {bucket_name}/{file_path}: {str(e)}',
            )
            return exception_handler.handle_not_found_error(
                message='File not found',
                extra={
                    'endpoint': 'get_public_file',
                    'bucket_name': bucket_name,
                    'file_path': file_path,
                },
            )

        # Detect content type from file extension
        file_extension = Path(file_path).suffix.lower()
        content_type_mapping = {
            # Documents
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            # Text
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.md': 'text/markdown',
            # Images
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            # Archives
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed',
        }

        content_type = content_type_mapping.get(
            file_extension, 'application/octet-stream',
        )

        # Get file data using MinioService
        try:
            # Use download_bytes to get the data as Future[bytes], then get the result
            future = minio_service.download_bytes(bucket_name, file_path)
            file_data = future.result()

            def generate():
                # Stream bytes data in chunks for better memory usage
                chunk_size = 8192  # 8KB chunks
                for i in range(0, len(file_data), chunk_size):
                    yield file_data[i:i + chunk_size]

            logger.info(
                f'Successfully streaming public file: {bucket_name}/{file_path} ({content_type})',
            )

            # Extract filename for Content-Disposition header
            filename = Path(file_path).name

            # Encode filename properly for Content-Disposition header (RFC 5987)
            # This handles Unicode characters (Vietnamese, Chinese, etc.)
            try:
                # Try ASCII encoding first (for simple filenames)
                filename.encode('ascii')
                content_disposition = f'inline; filename="{filename}"'
            except UnicodeEncodeError:
                # Use RFC 5987 encoding for non-ASCII filenames
                encoded_filename = quote(filename, safe='')
                content_disposition = f"inline; filename*=UTF-8''{encoded_filename}"

            # Return streaming response for better performance
            return StreamingResponse(
                generate(),
                media_type=content_type,
                headers={
                    'Cache-Control': 'public, max-age=86400',  # Cache for 24 hours
                    'Access-Control-Allow-Origin': '*',  # Allow CORS for public files
                    # Display inline with properly encoded filename
                    'Content-Disposition': content_disposition,
                },
            )

        except Exception as e:
            logger.error(
                f'Failed to stream file data: {bucket_name}/{file_path}: {str(e)}',
            )
            return exception_handler.handle_exception(
                e=f'Failed to stream file data: {str(e)}',
                extra={
                    'endpoint': 'get_public_file',
                    'bucket_name': bucket_name,
                    'file_path': file_path,
                },
            )

    except Exception as e:
        # Handle all errors using exception_handler
        logger.error(
            f'Failed to retrieve public file {bucket_name}/{file_path}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve public file: {str(e)}',
            extra={
                'endpoint': 'get_public_file',
                'bucket_name': bucket_name,
                'file_path': file_path,
                'error': str(e),
            },
        )
