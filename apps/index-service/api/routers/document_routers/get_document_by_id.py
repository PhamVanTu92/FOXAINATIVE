from __future__ import annotations

from uuid import UUID

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DocumentResponseSamples
from app.documents.get_document_by_id import GetDocumentByIdInput
from app.documents.get_document_by_id import GetDocumentByIdService
from fastapi import APIRouter
from fastapi import Depends
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    document_getting_by_id_service = GetDocumentByIdService(
        settings=settings.postgres,
    )
    logger.info('Document getting by ID service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize document getting by ID service: {str(e)}",
    )
    raise RuntimeError(
        f"Document getting by ID service initialization failed: {str(e)}",
    )


@router.get(
    '/documents/{document_id}',
    summary='Get document by ID with collection name',
    description="""Retrieve specific document details including associated collection information.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- document_id: UUID of document

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "id": "doc-uuid",
    "collection_id": "collection-uuid",
    "collection_name": "company_policies",
    "file_name": "policy.pdf",
    "file_path": "chatbot-foxai/collections/uuid/policy.pdf",
    "file_size": 1048576,
    "status": "completed",
    "processing_type": "document_structured_llm",
    "effective_from": "2026-01-01T00:00:00+07:00",
    "effective_to": "2027-01-01T00:00:00+07:00",
    "issuing_unit": "HR",
    "access_scope": "internal",
    "version": "v1.0",
    "created_at": "2026-02-02T10:30:00+07:00",
    "updated_at": "2026-02-02T10:35:00+07:00"
  }
}
```

Business Rules:
- Returns document with collection_name from JOIN query
- User must own the document's collection
- Includes full metadata and processing status
- File path can be used to construct download URLs

Common Errors:
- 400: Invalid UUID format
- 401: Missing or invalid access token
- 403: User does not own document's collection
- 404: Document not found

Integration Notes:
- Use for displaying detailed document information
- Check status field to show processing state
- Construct file download URL from file_path if needed""",
    responses=DocumentResponseSamples.get_document_by_id_responses(),
)
async def get_document_by_id(
    document_id: UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Get a specific document by its ID with collection_name included.

    This endpoint retrieves a single document with proper authentication and authorization:
    - Document ID is specified in the URL path
    - User ID is extracted from the authentication token
    - Returns document data including collection_name from JOIN
    - Access control ensures users can only view documents they have access to

    **Authentication & Authorization**:
    - Requires valid Bearer token (handled by dependency)
    - User must have view access permission (handled by dependency)
    - Document access is validated based on user permissions

    **Path Parameters**:
    - **document_id**: UUID of the document to retrieve

    Returns document data with collection_name, or 404 if not found/no access.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Getting document by ID - document_id={document_id}, user: {current_user.user_id}',
        )

        # Create service input
        service_input = GetDocumentByIdInput(
            document_id=document_id,
        )

        # Call the document getting by ID service
        result = await document_getting_by_id_service.process(service_input, db)

        # Check if document was not found
        if not result.data:
            logger.warning(
                f'Document not found - document_id={document_id}, user: {current_user.user_id}',
            )
            return exception_handler.handle_not_found_error(
                message=result.message,
                extra={
                    'endpoint': 'get_document_by_id',
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        logger.info(
            f'Document retrieved successfully - document_id={document_id}, '
            f'collection_name={result.data.collection_name}, user: {current_user.user_id}',
        )
        return exception_handler.handle_success(output=result.model_dump(mode='json'))

    except Exception as e:
        logger.error(
            f'Failed to get document by ID - document_id={document_id}, '
            f'user: {current_user.user_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve document: {str(e)}',
            extra={
                'endpoint': 'get_document_by_id',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
