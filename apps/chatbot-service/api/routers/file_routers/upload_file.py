from __future__ import annotations

import uuid
from typing import List

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_current_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import FileResponseSamples
from app.files import FileUploadInput
from app.files import FileUploadResult
from app.files import FileUploadService
from domain.document_processor import ALLOWED_EXTENSIONS
from domain.document_processor import MAX_FILE_SIZE_BYTES
from domain.document_processor import MAX_FILES_PER_UPLOAD
from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import UploadFile
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from pydantic import BaseModel
from pydantic import Field
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    file_upload_service = FileUploadService(postgres_settings=settings.postgres)
    logger.info('File upload service initialized successfully')
except Exception as e:
    logger.error(f'Failed to initialize file upload service: {str(e)}')
    raise RuntimeError(
        f'File upload service initialization failed: {str(e)}',
    )


# ── Response Models ──────────────────────────────────────────────────────────

class FileUploadResponse(BaseModel):
    """Response for file upload endpoint."""
    message: str
    files: List[FileUploadResult] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    '/files/upload',
    summary='Upload files for chat attachment',
    description=f"""Upload one or more files to be attached to a chat message.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Any authenticated user

Request Body: multipart/form-data
- files: One or more files (required)

Constraints:
- Maximum {MAX_FILES_PER_UPLOAD} files per upload
- Maximum {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB per file
- Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}

Success Response (200):
```json
{{{{
  "message": "Uploaded 2 file(s) successfully",
  "files": [
    {{{{
      "file_id": "uuid",
      "file_name": "report.pdf",
      "file_type": "pdf",
      "file_size": 1048576,
      "storage_url": "http://minio:9000/files-attachment/user-id/file-id.pdf",
      "processing_status": "completed"
    }}}}
  ],
  "errors": []
}}}}
```

Business Rules:
- Files are stored in MinIO object storage
- Content is automatically extracted (OCR for scanned PDFs/images, text for DOCX/XLSX/text PDFs)
- File metadata saved to database with extracted content for later retrieval
- Response returns file_ids (without extracted_content) for use in /v1/agents/chat/stream
- Partial success: some files may succeed while others fail, both reported in response

Flow:
1. Upload files → receive file_ids
2. Send file_ids in POST /v1/agents/chat/stream request body
3. Agent uses extracted content as context for AI responses

Common Errors:
- 400: No files provided, exceeds max file count, all files failed
- 401: Missing or invalid access token
- 422: Invalid file format / multipart validation error
- 500: MinIO unavailable, processing service error

Integration Notes:
- Use multipart/form-data with field name 'files'
- Multiple files: repeat 'files' field for each file
- Show upload progress indicator for large files
- Store returned file_ids for subsequent chat requests
- Display processing_status and errors to inform user of any issues""",
    responses=FileResponseSamples.upload_file_responses(),
    status_code=status.HTTP_200_OK,
)
async def upload_files(
    files: List[UploadFile] = File(
        ..., description='Files to upload (multipart/form-data)',
    ),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    Upload and process files for chat attachment.

    Files are validated, stored in MinIO, content extracted, and metadata
    saved to database. Returns file_ids for subsequent chat requests.

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - Any authenticated user can upload files

    **Parameters**:
    - **files**: One or more files via multipart/form-data

    Returns file upload results with file_ids and any errors.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )
    user_id = current_user.user_id

    try:
        logger.info(
            f'Processing file upload - {len(files)} file(s), '
            f'user: {current_user.user_id}',
        )

        # Create app service input
        service_input = FileUploadInput(
            files=files,
            user_id=current_user.user_id,
        )

        # Process via app service
        result = await file_upload_service.process(service_input, db)

        if not result.success:
            return exception_handler.handle_bad_request(
                message=result.message,
                extra={
                    'endpoint': 'upload_files',
                    'user_id': str(user_id),
                    'errors': result.errors,
                },
            )

        logger.info(
            f'File upload completed - {len(result.results)} succeeded, '
            f'{len(result.errors)} errors, user: {current_user.user_id}',
        )

        return exception_handler.handle_success(
            output=FileUploadResponse(
                message=result.message,
                files=result.results,
                errors=result.errors,
            ).model_dump(mode='json'),
        )

    except Exception as e:
        logger.error(
            f'Failed to upload files for user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to upload files: {str(e)}',
            extra={
                'endpoint': 'upload_files',
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )



