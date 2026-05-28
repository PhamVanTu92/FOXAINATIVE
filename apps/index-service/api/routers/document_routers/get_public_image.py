"""
Public image endpoint to serve MinIO images without authentication.
This endpoint allows public access to images stored in MinIO for display in external systems.
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
    logger.info(
        'MinIO service initialized successfully for public image serving',
    )
except Exception as e:
    logger.error(f"Failed to initialize MinIO service: {str(e)}")
    raise RuntimeError(f"MinIO service initialization failed: {str(e)}")


@router.get(
    '/public/images/{bucket_name}/{image_path:path}',
    responses={
        status.HTTP_200_OK: {
            'description': 'Image retrieved successfully',
            'content': {
                'image/png': {},
                'image/jpeg': {},
                'image/gif': {},
                'image/webp': {},
            },
        },
        status.HTTP_404_NOT_FOUND: {
            'description': 'Image not found',
            'content': {
                'application/json': {
                    'example': {
                        'message': 'Image not found',
                    },
                },
            },
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            'description': 'Internal Server Error - Failed to retrieve image',
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
    summary='Get public image from MinIO storage',
    description='Retrieve and serve images from MinIO storage without authentication. For public display in external systems like Qdrant or web interfaces.',
)
async def get_public_image(
    bucket_name: str,
    image_path: str,
):
    """
    Retrieve and serve images from MinIO storage without authentication.

    This endpoint serves images stored in MinIO for public access:
    - No authentication required
    - Returns raw image data with appropriate content type
    - Handles various image formats (PNG, JPEG, GIF, WebP)
    - Designed for external systems like Qdrant that need image URLs

    **Security Considerations**:
    - Only serves images from allowed buckets
    - Prevents path traversal attacks
    - Rate limiting should be implemented at reverse proxy level

    **Image Processing**:
    - Supports multiple image formats
    - Automatic content type detection
    - Efficient streaming of image data

    **Process Flow**:
    1. Validate bucket and image path parameters
    2. Check security constraints
    3. Retrieve image data from MinIO storage
    4. Detect and set appropriate content type
    5. Return raw image data as response
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Input validation
    if not bucket_name or not bucket_name.strip():
        return exception_handler.handle_bad_request(
            message='Bucket name is required',
            extra={
                'endpoint': 'get_public_image',
                'bucket_name': bucket_name,
            },
        )

    if not image_path or not image_path.strip():
        return exception_handler.handle_bad_request(
            message='Image path is required',
            extra={
                'endpoint': 'get_public_image',
                'image_path': image_path,
            },
        )

    # Sanitize inputs
    bucket_name = bucket_name.strip()
    image_path = image_path.strip()

    # Security: Only allow specific buckets for public access
    allowed_buckets = ['document-images', 'public-images', 'chatbot-images']
    if bucket_name not in allowed_buckets:
        return exception_handler.handle_bad_request(
            message='Access to this bucket is not allowed',
            extra={
                'endpoint': 'get_public_image',
                'bucket_name': bucket_name,
                'allowed_buckets': allowed_buckets,
            },
        )

    # Security: Prevent path traversal attacks
    if '..' in image_path or image_path.startswith('/'):
        return exception_handler.handle_bad_request(
            message='Invalid image path format',
            extra={
                'endpoint': 'get_public_image',
                'image_path': image_path,
            },
        )

    try:
        logger.info(f'Retrieving public image: {bucket_name}/{image_path}')

        # Check if bucket exists
        if not minio_service.bucket_manager.bucket_exists(bucket_name):
            logger.warning(f'Bucket not found: {bucket_name}')
            return exception_handler.handle_not_found_error(
                message='Bucket not found',
                extra={
                    'endpoint': 'get_public_image',
                    'bucket_name': bucket_name,
                },
            )

        # Check if object exists
        try:
            _ = minio_service.get_object_info(bucket_name, image_path)
        except Exception as e:
            logger.warning(
                f'Public image not found: {bucket_name}/{image_path}: {str(e)}',
            )
            return exception_handler.handle_not_found_error(
                message='Image not found',
                extra={
                    'endpoint': 'get_public_image',
                    'bucket_name': bucket_name,
                    'image_path': image_path,
                },
            )

        # Detect content type from file extension first
        file_extension = Path(image_path).suffix.lower()
        content_type_mapping = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
        }

        content_type = content_type_mapping.get(file_extension, 'image/png')

        # Get image data using MinioService
        try:
            # Use download_bytes to get the data as Future[bytes], then get the result
            future = minio_service.download_bytes(bucket_name, image_path)
            image_data = future.result()

            def generate():
                # Stream bytes data in chunks for better memory usage
                chunk_size = 8192  # 8KB chunks
                for i in range(0, len(image_data), chunk_size):
                    yield image_data[i:i + chunk_size]

            logger.info(
                f'Successfully streaming public image: {bucket_name}/{image_path} ({content_type})',
            )

            # Extract filename for Content-Disposition header
            filename = Path(image_path).name

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
                    'Access-Control-Allow-Origin': '*',  # Allow CORS for public images
                    # Display inline with properly encoded filename
                    'Content-Disposition': content_disposition,
                },
            )

        except Exception as e:
            logger.error(
                f'Failed to stream image data: {bucket_name}/{image_path}: {str(e)}',
            )
            return exception_handler.handle_exception(
                e=f'Failed to stream image data: {str(e)}',
                extra={
                    'endpoint': 'get_public_image',
                    'bucket_name': bucket_name,
                    'image_path': image_path,
                },
            )

    except Exception as e:
        # Handle all errors using exception_handler
        logger.error(
            f'Failed to retrieve public image {bucket_name}/{image_path}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve public image: {str(e)}',
            extra={
                'endpoint': 'get_public_image',
                'bucket_name': bucket_name,
                'image_path': image_path,
                'error': str(e),
            },
        )
