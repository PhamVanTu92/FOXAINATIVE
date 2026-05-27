from __future__ import annotations

from pathlib import Path
from typing import List
from uuid import UUID

from api.helpers.dependencies.collection_validation import get_collection_name_by_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DocumentResponseSamples
from app.documents.batch_upload import BatchUploadInput
from app.documents.batch_upload import BatchUploadService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import status
from fastapi import UploadFile
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

# Initialize service
try:
    batch_upload_service = BatchUploadService(settings=settings)
    logger.info('Batch upload service initialized successfully')
except Exception as e:
    logger.error(f"Failed to initialize batch upload service: {str(e)}")
    raise RuntimeError(f"Batch upload service initialization failed: {str(e)}")


@router.post(
    '/{collection_id}/documents/batch-upload',
    responses=DocumentResponseSamples.batch_upload_responses(),
    status_code=status.HTTP_201_CREATED,
    summary='Batch upload multiple documents (Step 1 of 2)',
    description="""Upload multiple files to storage and create document records (status: pending).

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- collection_id: UUID of target collection

Request: multipart/form-data
- files: Multiple file uploads (max 10 files per request)

File Validation:
- Max file size: 10MB per file
- Allowed formats: PDF, DOCX, DOC, TXT, XLSX, XLS, CSV
- File name restrictions: max 255 characters, no special characters except underscore/hyphen/dot

Success Response (201):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Files uploaded successfully. Call batch-process endpoint to start processing.",
    "documents": [
      {
        "document_id": "doc-uuid-1",
        "file_name": "policy.pdf",
        "file_url": "chatbot-foxai/collections/uuid/policy.pdf",
        "status": "draft"
      }
    ],
    "successful_count": 5,
    "failed_count": 0,
    "total_count": 5
  }
}
```

Business Rules:
- Step 1 of 2-step process (upload then process)
- Documents created with status='pending' and processing_type=null
- Files stored in MinIO with auto-generated paths
- Duplicate file names in same collection not allowed
- Maximum 10 concurrent file uploads per request
- Metadata provided in Step 2 (batch-process endpoint)

Common Errors:
- 400: Invalid collection_id, file size exceeded, invalid file format, duplicate filenames
- 401: Missing or invalid access token
- 403: User does not own collection
- 404: Collection not found
- 413: Request payload too large (total size > 100MB)

Integration Notes:
- Use multipart/form-data content type
- Validate file size and format client-side before upload
- Show upload progress for each file
- Store returned document_ids for Step 2 (batch-process)
- Display pending status until processing starts
- Call POST /{collection_id}/documents/batch-process with document_ids to start processing""",
)
async def batch_upload_documents(
    collection_id: UUID,
    files: List[UploadFile] = File(
        ...,
        description='Multiple document files to upload (max 10)',
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Batch upload multiple documents (Step 1 - Upload Only).

    **This endpoint only handles upload, not processing!**
    **Metadata will be provided in Step 2 (batch-process endpoint)**

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)

    **Process Flow**:
    1. Validate all files (size, extension, duplicates)
    2. Upload all files to MinIO in parallel
    3. Create document records with status='pending', processing_type=None
    4. Return document_ids immediately
    5. Call POST /collections/{id}/documents/batch-process with metadata to start processing

    **Limits:**
    - Maximum 10 files per batch
    - Maximum 100MB per file
    - Maximum 500MB total batch size
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Validate collection
    try:
        collection_name = get_collection_name_by_id(
            collection_id=collection_id, db=db,
        )
        logger.info(
            f'Batch upload to collection: {collection_name} (ID: {collection_id})',
        )
    except Exception as e:
        logger.error(f'Collection validation failed: {str(e)}')
        return exception_handler.handle_not_found_error(
            message=f'Collection with ID {collection_id} not found',
            extra={
                'endpoint': 'batch_upload_documents',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
            },
        )

    # Validate files basic requirements
    if not files or len(files) == 0:
        return exception_handler.handle_bad_request(
            message='No files provided',
            extra={
                'endpoint': 'batch_upload_documents',
                'collection_id': str(collection_id),
            },
        )

    if len(files) > batch_upload_service.max_files:
        return exception_handler.handle_bad_request(
            message=f'Too many files. Maximum {batch_upload_service.max_files} files per batch',
            extra={
                'endpoint': 'batch_upload_documents',
                'files_count': len(files),
                'max_files': batch_upload_service.max_files,
            },
        )

    # Validate file extensions and check for duplicates
    allowed_extensions = batch_upload_service.allowed_extensions
    filenames = []

    for idx, file in enumerate(files):
        if not file.filename:
            return exception_handler.handle_bad_request(
                message=f'File at index {idx} has no filename',
                extra={'endpoint': 'batch_upload_documents', 'file_index': idx},
            )

        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in allowed_extensions:
            return exception_handler.handle_bad_request(
                message=f'Unsupported file type: {file_extension}',
                extra={
                    'endpoint': 'batch_upload_documents',
                    'file': file.filename,
                    'allowed': sorted(allowed_extensions),
                },
            )

        filenames.append(file.filename)

    # Check for duplicate filenames
    if len(filenames) != len(set(filenames)):
        return exception_handler.handle_bad_request(
            message='Duplicate filenames detected in batch',
            extra={'endpoint': 'batch_upload_documents'},
        )

    # Read all files and validate sizes
    try:
        files_data = []
        total_size = 0

        for idx, file in enumerate(files):
            file_content = await file.read()
            file_size = len(file_content)

            # Validate individual file size
            if file_size > batch_upload_service.max_file_size:
                return exception_handler.handle_bad_request(
                    message=f'File "{file.filename}" exceeds maximum size of {batch_upload_service.max_file_size // (1024 * 1024)}MB',
                    extra={
                        'endpoint': 'batch_upload_documents',
                        'file': file.filename,
                        'size': file_size,
                    },
                )

            if file_size == 0:
                return exception_handler.handle_bad_request(
                    message=f'File "{file.filename}" is empty',
                    extra={
                        'endpoint': 'batch_upload_documents',
                        'file': file.filename,
                    },
                )

            total_size += file_size
            files_data.append({
                'file': file,
                'content': file_content,
                'size': file_size,
                'filename': file.filename,
            })

        # Validate total batch size
        if total_size > batch_upload_service.max_batch_size:
            return exception_handler.handle_bad_request(
                message=f'Total batch size exceeds maximum of {batch_upload_service.max_batch_size // (1024 * 1024)}MB',
                extra={
                    'endpoint': 'batch_upload_documents',
                    'total_size': total_size,
                },
            )

        logger.info(
            f'Validated {len(files_data)} files, total size: {total_size} bytes',
        )

    except Exception as e:
        return exception_handler.handle_exception(
            e=f'Failed to read files: {str(e)}',
            extra={'endpoint': 'batch_upload_documents'},
        )

    # Call batch upload service
    try:
        service_input = BatchUploadInput(
            files_data=files_data,
            collection_id=collection_id,
            user_id=current_user.user_id,
        )

        result = await batch_upload_service.process(service_input, db)

        logger.info(
            f'Batch upload completed: {result.successful_count} files uploaded',
        )
        return exception_handler.handle_created(output=result.model_dump())

    except Exception as e:
        logger.error(f'Batch upload failed: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Batch upload failed: {str(e)}',
            extra={
                'endpoint': 'batch_upload_documents',
                'collection_id': str(collection_id),
                'files_count': len(files),
            },
        )
