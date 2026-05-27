from __future__ import annotations

from uuid import UUID

from api.helpers.dependencies.collection_validation import get_collection_name_by_document_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import DocumentResponseSamples
from app.documents import DocumentDeletionInput
from app.documents import DocumentDeletionOutput
from app.documents import DocumentDeletionService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


@router.delete(
    '/{document_id}',
    response_model=DocumentDeletionOutput,
    responses=DocumentResponseSamples.delete_document_responses(),
    status_code=status.HTTP_200_OK,
    summary='Delete a document from a collection',
    description="""Delete document from collection including file storage and vector embeddings.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- document_id: UUID of document to delete

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "id": "doc-uuid",
    "file_name": "policy.pdf",
    "deleted": true
  }
}
```

Business Rules:
- Only document owner (collection owner) can delete
- Deletes from PostgreSQL, MinIO storage, and Qdrant vectors
- Cascades deletion to all associated chunks and embeddings
- Operation is irreversible (no soft delete)
- Deletion is synchronous and completes immediately

Common Errors:
- 400: Invalid UUID format for document_id
- 401: Missing or invalid access token
- 403: User does not own this document's collection
- 404: Document not found

Integration Notes:
- Show confirmation dialog before deletion
- Remove document from local cache after successful deletion
- Update collection document count in UI
- Handle 404 gracefully if document already deleted""",
)
async def delete_document(
    document_id: UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """
    Delete a specific document from both PostgreSQL and Qdrant by document ID.

    This endpoint deletes documents with simple authentication:
    - Document ID is specified in the URL path
    - User ID is extracted from the authentication token
    - Service handles finding and deleting the document
    - Uses default embedding provider (foxaillm) for Qdrant operations

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)

    **Process Flow**:
    1. Validate input parameters (document_id from path)
    2. Call deletion service with document_id
    3. Service handles all database and vector store cleanup
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    # Input validation
    if not document_id:
        return exception_handler.handle_bad_request(
            message='Document ID is required',
            extra={
                'endpoint': 'delete_document',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
            },
        )

    try:
        # Initialize service with default providers (deletion doesn't create new vectors)
        document_deletion_service = DocumentDeletionService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        logger.info(
            f'Deleting document: {document_id} by user: {current_user.user_id}',
        )

        # Get collection_name from document_id using validation helper
        collection_name = get_collection_name_by_document_id(
            document_id=document_id,
            db=db,
        )

        # Create input for deletion service
        deletion_input = DocumentDeletionInput(
            document_id=document_id,
            collection_name=collection_name,
        )

        # Call the document deletion service
        result = await document_deletion_service.process(deletion_input, db)

        logger.info(f'Document deletion completed for: {document_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid document ID format {document_id}: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid document ID format: {str(e)}',
            extra={
                'endpoint': 'delete_document',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
            },
        )
    except Exception as e:
        error_msg = str(e).lower()

        # Check if it's a "not found" error
        if 'not found' in error_msg or 'does not exist' in error_msg:
            logger.warning(f'Document {document_id} not found: {str(e)}')
            return exception_handler.handle_not_found_error(
                message=f'Document with ID {document_id} not found',
                extra={
                    'endpoint': 'delete_document',
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(f'Failed to delete document {document_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Document deletion failed: {str(e)}',
            extra={
                'endpoint': 'delete_document',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
