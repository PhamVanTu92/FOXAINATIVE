from __future__ import annotations

from typing import Optional
from uuid import UUID

from api.helpers.dependencies.collection_validation import get_collection_name_by_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DocumentResponseSamples
from app.documents.get_document import GetDocumentInput
from app.documents.get_document import GetDocumentService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

# No more manual SecurityDependencies initialization needed!

try:
    document_getting_service = GetDocumentService(
        settings=settings.postgres,
    )
    logger.info('Document getting service initialized successfully')
except Exception as e:
    logger.error(f"Failed to initialize document getting service: {str(e)}")
    raise RuntimeError(
        f"Document getting service initialization failed: {str(e)}",
    )


@router.get(
    '/{collection_id}/documents',
    summary='Get documents with pagination and filters',
    description="""Retrieve paginated list of documents in specific collection with filtering.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- collection_id: UUID of collection

Query Parameters:
- page: Page number (integer, min 1, default 1)
- page_size: Items per page (integer, min 1, max 100, default 10)
- search: Search term to filter by file name (optional)
- processing_status: Filter by status (optional, enum: pending, processing, completed, failed)
- processing_type: Filter by type (optional, enum: excel, document_structured_llm)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "items": [
      {
        "id": "doc-uuid",
        "collection_id": "collection-uuid",
        "file_name": "policy.pdf",
        "file_size": 1048576,
        "status": "completed",
        "processing_type": "document_structured_llm",
        "effective_from": "2026-01-01T00:00:00+07:00",
        "effective_to": "2027-01-01T00:00:00+07:00",
        "issuing_unit": "HR",
        "created_at": "2026-02-02T10:30:00+07:00"
      }
    ],
    "total": 25,
    "page": 1,
    "page_size": 10,
    "total_pages": 3
  }
}
```

Business Rules:
- Returns documents only from specified collection
- User must own the collection to view documents
- Status filters: pending (uploaded), processing (in queue), completed (ready), failed (error)
- Results ordered by creation date (newest first)

Common Errors:
- 400: Invalid page, page_size, or filter values
- 401: Missing or invalid access token
- 403: User does not own collection
- 404: Collection not found

Integration Notes:
- Use status filter to show only pending/processing/completed documents
- Display processing status with appropriate UI indicators
- Implement pagination for large document sets
- Poll endpoint to track processing progress""",
    responses=DocumentResponseSamples.get_document_responses(),
)
async def get_documents(
    collection_id: UUID,
    page: int = Query(1, ge=1, description='Page number (starting from 1)'),
    page_size: int = Query(
        10, ge=1, le=100, description='Number of documents per page (1-100)',
    ),
    search: Optional[str] = Query(
        None, description='Search term to filter documents by name',
    ),
    processing_status: Optional[str] = Query(
        None, description='Filter by processing status: pending, processing, completed, failed',
    ),
    processing_type: Optional[str] = Query(
        None, description="Filter by processing type: 'excel' or 'document_structured_llm'",
    ),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Get paginated documents with proper authentication and authorization.

    This endpoint retrieves documents with proper user context:
    - Collection ID is specified in the URL path
    - User ID is extracted from the authentication token (not from query parameters)
    - Documents are filtered by the specific collection only
    - Access control ensures users can only view documents they have access to

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - User must have view access permission (handled by dependency)
    - Collection access is validated based on collection_id parameter

    **Query Parameters**:
    - **page**: Page number (default: 1)
    - **page_size**: Documents per page (default: 10, max: 100)
    - **search**: Search term to filter documents by name (optional)

    Returns paginated document data with total count and page information.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Validate page parameters
    if page < 1:
        return exception_handler.handle_bad_request(
            message='Page number must be greater than 0',
            extra={
                'endpoint': 'get_documents',
                'page': page,
                'user_id': str(current_user.user_id),
                'collection_id': str(collection_id),
            },
        )

    if page_size < 1 or page_size > 100:
        return exception_handler.handle_bad_request(
            message='Page size must be between 1 and 100',
            extra={
                'endpoint': 'get_documents',
                'page_size': page_size,
                'user_id': str(current_user.user_id),
                'collection_id': str(collection_id),
            },
        )

    # Determine target organization from path parameter
    # Get collection_name from collection_id for validation
    collection_name_validated = get_collection_name_by_id(
        collection_id=collection_id,
        db=db,
    )

    try:
        logger.info(
            f'Getting documents - page={page}, page_size={page_size}, '
            f'collection_id={collection_id}, collection_name={collection_name_validated}, '
            f'search={search}, processing_status={processing_status}, processing_type={processing_type}, user: {current_user.user_id}',
        )

        # Create service input with collection filtering
        service_input = GetDocumentInput(
            page=page,
            page_size=page_size,
            collection_name=collection_name_validated,
            search=search,
            processing_status=processing_status,
            processing_type=processing_type,
        )

        # Call the document getting service
        result = await document_getting_service.process(service_input, db)

        # Check if there's an error in the result message
        if not result.data and ('error' in result.message.lower() or 'failed' in result.message.lower()):
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_documents',
                    'page': page,
                    'page_size': page_size,
                    'collection_id': str(collection_id),
                    'user_id': str(current_user.user_id),
                    'collection_name': collection_name_validated,
                },
            )

        logger.info(
            f'Documents retrieved successfully - page={page}, total={result.data.total if result.data else 0}, '
            f'collection_id: {collection_id}, user: {current_user.user_id}',
        )
        return exception_handler.handle_success(output=result.model_dump(mode='json'))

    except Exception as e:
        logger.error(
            f'Failed to get documents - page={page}, page_size={page_size}, '
            f'collection_id: {collection_id}, user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve documents: {str(e)}',
            extra={
                'endpoint': 'get_documents',
                'page': page,
                'page_size': page_size,
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
                'collection_name': collection_name_validated,
                'error': str(e),
            },
        )
