from __future__ import annotations

from typing import List
from typing import Optional
from uuid import UUID

from api.helpers.dependencies.collection_validation import get_collection_name_by_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DocumentResponseSamples
from app.documents.batch_process import BatchProcessDocumentInput
from app.documents.batch_process import BatchProcessDocumentService
from app.documents.create_document import DocumentProcessingType
from fastapi import APIRouter
from fastapi import Body
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    batch_process_document_service = BatchProcessDocumentService(
        settings=settings,
    )
    logger.info('Batch process document service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize batch process document service: {str(e)}",
    )
    raise RuntimeError(
        f"Batch process document service initialization failed: {str(e)}",
    )


@router.post(
    '/{collection_id}/documents/batch-process',
    responses=DocumentResponseSamples.batch_process_responses(),
    status_code=status.HTTP_202_ACCEPTED,
    summary='Trigger batch document processing (Step 2 of 2)',
    description="""Start background processing for uploaded documents with shared metadata.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- collection_id: UUID of target collection

Request Body:
```json
{
  "document_ids": [
    "doc-uuid-1",
    "doc-uuid-2",
    "doc-uuid-3"
  ],
  "processing_type": "document_structured_llm",
  "issuing_unit": "Human Resources",
  "access_scope": "internal",
  "version": "v1.0"
}
```

Validation Rules:
- document_ids: Required, array of UUIDs, must be from same collection, status must be 'pending'
- processing_type: Required, enum ['excel', 'document_structured_llm']
- issuing_unit: Optional, max 200 characters
- access_scope: Optional, max 100 characters
- version: Optional, max 50 characters

Success Response (202 Accepted):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "collection_id": "collection-uuid",
    "total_documents": 3,
    "processing_status": "queued",
    "message": "Documents queued for background processing"
  }
}
```

Business Rules:
- Step 2 of 2-step process (must call after batch-upload)
- All documents receive same metadata values
- Processing runs asynchronously in background
- Document status changes: pending -> processing -> completed/failed
- processing_type determines parsing strategy:
  * 'excel': Extract tabular data from spreadsheets
  * 'document_structured_llm': Use LLM for structured text extraction
- Metadata applies to all documents in batch

Common Errors:
- 400: Invalid document_ids, documents not in pending status, invalid processing_type
- 401: Missing or invalid access token
- 403: User does not own collection or documents
- 404: Collection or documents not found
- 422: Validation error on metadata fields

Integration Notes:
- Call immediately after successful batch-upload
- Use 202 status to indicate async processing started
- Poll document status or use webhooks to track completion
- All documents in batch share same metadata (design consideration)
- Use separate uploads if documents need different metadata""",
)
async def batch_process_documents(
    collection_id: UUID,
    document_ids: List[UUID] = Body(
        ...,
        description='List of document IDs to process',
    ),
    processing_type: str = Body(
        ..., description="Type of document processing: 'excel' or 'document_structured_llm'",
    ),
    issuing_unit: Optional[str] = Body(
        None, description='Organization or unit that issued the documents',
    ),
    access_scope: Optional[str] = Body(
        None, description='Access scope for the documents',
    ),
    version: Optional[str] = Body(None, description='Document version'),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Trigger batch document processing with shared metadata.

    **This is Step 2 of the 2-step batch upload process:**
    1. First call POST /collections/{id}/documents/batch-upload to upload files
    2. Then call this endpoint to provide metadata and start processing

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)

    **Process Flow**:
    1. Validate all documents exist and belong to the collection
    2. Bulk update document metadata (processing_type, dates, etc.)
    3. Trigger background processing for each document in parallel
    4. Return immediately with 202 Accepted (processing continues in background)
    5. Check document status via GET /collections/{id}/documents

    **Shared Metadata**:
    - Same metadata will be applied to ALL documents in the batch
    - All documents must be in 'pending' status (uploaded but not processed)
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Validate collection exists
    try:
        collection_name = get_collection_name_by_id(
            collection_id=collection_id, db=db,
        )
        logger.info(
            f'Batch processing for collection: {collection_name} (ID: {collection_id})',
        )
    except Exception as e:
        logger.error(f'Collection validation failed: {str(e)}')
        return exception_handler.handle_not_found_error(
            message=f'Collection with ID {collection_id} not found',
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
            },
        )

    # Input validation
    if not document_ids or len(document_ids) == 0:
        return exception_handler.handle_bad_request(
            message='No document IDs provided',
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
            },
        )

    if not processing_type:
        return exception_handler.handle_bad_request(
            message='Processing type is required',
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
            },
        )

    # Validate processing_type against allowed values BEFORE accepting the job.
    # Without this, an invalid value still returns 202 but every document fails
    # silently in the background when DocumentCreationInput rejects the enum.
    allowed_processing_types = {t.value for t in DocumentProcessingType}
    if processing_type not in allowed_processing_types:
        return exception_handler.handle_bad_request(
            message=(
                f"Invalid processing_type '{processing_type}'. "
                f"Allowed values: {sorted(allowed_processing_types)}"
            ),
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
                'processing_type': processing_type,
            },
        )

    try:
        logger.info(
            f'Processing batch: {len(document_ids)} documents with type: {processing_type} '
            f'by user: {current_user.user_id}',
        )

        # Create service input
        service_input = BatchProcessDocumentInput(
            document_ids=document_ids,
            processing_type=processing_type,
            issuing_unit=issuing_unit,
            access_scope=access_scope,
            version=version,
        )

        # Call the batch process document service
        result = await batch_process_document_service.process(service_input, db)

        logger.info(
            f'Batch processing triggered for {len(document_ids)} documents',
        )
        return exception_handler.handle_accepted(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid input: {str(e)}')
        return exception_handler.handle_bad_request(
            message=str(e),
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
            },
        )
    except Exception as e:
        logger.error(f'Batch processing failed: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Batch processing failed: {str(e)}',
            extra={
                'endpoint': 'batch_process_documents',
                'collection_id': str(collection_id),
                'document_count': len(document_ids),
            },
        )
