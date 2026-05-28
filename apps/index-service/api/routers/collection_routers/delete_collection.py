from __future__ import annotations

from uuid import UUID

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import CollectionResponseSamples
from app.colllections import CollectionDeletionInput
from app.colllections import CollectionDeletionOutput
from app.colllections import CollectionDeletionService
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
    '/collections/{collection_id}',
    response_model=CollectionDeletionOutput,
    responses=CollectionResponseSamples.delete_collection_responses(),
    status_code=status.HTTP_200_OK,
    summary='Delete a collection',
    description="""Delete collection and all associated documents from storage.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- collection_id: UUID of the collection to delete

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "collection_id": "123e4567-e89b-12d3-a456-426614174000",
    "collection_name": "company_policies",
    "message": "Collection deleted successfully"
  }
}
```

Business Rules:
- Only collection owner can delete their collections
- Deletes collection from both PostgreSQL and Qdrant
- Cascades deletion to all associated documents and vectors
- Operation is irreversible (no soft delete)
- Deletion is synchronous and completes immediately

Common Errors:
- 400: Invalid UUID format for collection_id
- 401: Missing or invalid access token
- 403: User does not own this collection
- 404: Collection not found

Integration Notes:
- Show confirmation dialog before deletion
- Warn user about cascade deletion of all documents
- Remove collection from local cache after successful deletion
- Handle 404 gracefully if collection already deleted""",
)
async def delete_collection(
    collection_id: UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> CollectionDeletionOutput:
    """
    Delete a specific collection from both PostgreSQL and Qdrant by collection ID.

    This endpoint deletes collections:
    - User ID is extracted from the authentication token
    - Collection ID is validated for proper format
    - Collections can only be deleted by the owner (authenticated user)
    - Uses default embedding provider (foxaillm) for Qdrant operations

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        # Initialize service with default providers (deletion doesn't create new vectors)
        collection_deletion_service = CollectionDeletionService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        logger.info(
            f'Deleting collection: {collection_id} '
            f'by user: {current_user.user_id}',
        )

        # Create input for deletion service
        deletion_input = CollectionDeletionInput(
            collection_id=collection_id,
            user_id=current_user.user_id,
        )

        # Call the collection deletion service
        result = await collection_deletion_service.process(deletion_input, db=db)

        logger.info(f'Collection deletion completed for: {collection_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid collection ID format {collection_id}: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid collection ID format: {str(e)}',
            extra={
                'endpoint': 'delete_collection',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
            },
        )
    except Exception as e:
        error_msg = str(e).lower()

        # Check if it's a "not found" error
        if 'not found' in error_msg or 'does not exist' in error_msg:
            logger.warning(f'Collection {collection_id} not found: {str(e)}')
            return exception_handler.handle_not_found_error(
                message=f'Collection with ID {collection_id} not found',
                extra={
                    'endpoint': 'delete_collection',
                    'collection_id': str(collection_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(f'Failed to delete collection {collection_id}: {str(e)}')
        return exception_handler.handle_exception(
            e=f'Collection deletion failed: {str(e)}',
            extra={
                'endpoint': 'delete_collection',
                'collection_id': str(collection_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
