from __future__ import annotations

import re
import unicodedata

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import CollectionResponseSamples
from app.colllections.create_collection import CollectionCreationInput
from app.colllections.create_collection import CollectionCreationOutput
from app.colllections.create_collection import CollectionCreationService
from app.colllections.create_collection import CreateCollectionRequest
from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


@router.post(
    '/collections',
    response_model=CollectionCreationOutput,
    responses=CollectionResponseSamples.create_collection_responses(),
    status_code=status.HTTP_201_CREATED,
    summary='Create a new collection',
    description="""Create new Qdrant collection for document storage and retrieval.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Request Body:
```json
{
  "name": "company_policies",
  "description": "Internal company policy documents",
  "embedding_provider": "openai",
  "storage_provider": "qdrant"
}
```

Validation Rules:
- name: Required; letters (including Vietnamese with diacritics), numbers, spaces, underscore and hyphen — e.g. "Tri thức nội bộ"
- description: Optional, max 500 characters
- embedding_provider: Optional, defaults to "foxaillm"
- storage_provider: Optional, defaults to "qdrant"

Success Response (201):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Collection created successfully",
    "collection_id": "123e4567-e89b-12d3-a456-426614174000",
    "collection_name": "company_policies"
  }
}
```

Business Rules:
- Collection name must be unique per user
- Collection belongs to authenticated user only
- Creates vector collection in Qdrant storage
- Embedding provider determines vector dimension size

Common Errors:
- 400: Invalid collection name format or duplicate name
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 422: Validation error on field constraints

Integration Notes:
- Validate collection name client-side allowing Unicode letters, numbers, spaces, underscore and hyphen (e.g. "Tri thức nội bộ")
- Store returned collection ID for document uploads
- Collection creation is synchronous and completes immediately""",
)
async def create_collection(
    request: CreateCollectionRequest,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> CollectionCreationOutput:
    """
    Create a new Qdrant collection with authentication.

    This endpoint creates collections:
    - User authentication is required (JWT token)
    - Collection belongs to the authenticated user
    - Collection name is validated for proper format
    - Embedding provider can be specified in request body (defaults to foxaillm)
    - Storage provider can be specified in request body (defaults to qdrant)
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        # Initialize service with providers from request body
        collection_creation_service = CollectionCreationService(
            settings=settings,
            provider_storage=request.provider_storage,
            provider_embedding=request.provider_embedding,
        )

        # Normalize: trim surrounding whitespace and unify Unicode form (NFC) so
        # Vietnamese names compare/store consistently (e.g. "Tri thức nội bộ").
        collection_name = unicodedata.normalize(
            'NFC', request.collection_name or '',
        ).strip()

        # Validate collection name is present
        if not collection_name:
            return exception_handler.handle_bad_request(
                message='Collection name is required and cannot be empty',
                extra={
                    'endpoint': 'create_collection',
                    'collection_name': request.collection_name,
                    'user_id': str(current_user.user_id),
                },
            )

        # Validate collection name format. Allow Unicode letters (including
        # Vietnamese with diacritics), numbers, spaces, underscore and hyphen —
        # e.g. "Tri thức nội bộ". Other symbols / control chars are rejected.
        if not re.match(r'^[\w -]+$', collection_name, re.UNICODE):
            return exception_handler.handle_bad_request(
                message=(
                    'Collection name can only contain letters (including '
                    'Vietnamese), numbers, spaces, underscore, and hyphen'
                ),
                extra={
                    'endpoint': 'create_collection',
                    'collection_name': request.collection_name,
                    'user_id': str(current_user.user_id),
                },
            )

        # Create internal service input (collection belongs to user)
        service_input = CollectionCreationInput(
            collection_name=collection_name,
            user_id=current_user.user_id,
            description=request.description or '',
            provider_embedding=request.provider_embedding,
            provider_storage=request.provider_storage,
        )

        logger.info(
            f'Creating collection: {collection_name} '
            f'by user: {current_user.user_id} with provider: {request.provider_embedding}',
        )

        # Call the collection creation service
        result = await collection_creation_service.process(service_input, db)

        logger.info(
            f'Collection creation completed for: {collection_name}',
        )
        return exception_handler.handle_success(output=result.model_dump())

    except Exception as e:
        error_msg = str(e).lower()

        # Check for specific error types
        if 'already exists' in error_msg or 'duplicate' in error_msg:
            return exception_handler.handle_bad_request(
                message=f'Collection \'{request.collection_name}\' already exists',
                extra={
                    'endpoint': 'create_collection',
                    'collection_name': request.collection_name,
                    'user_id': str(current_user.user_id),
                    'error': str(e),
                },
            )

        # Other errors
        logger.error(
            f'Failed to create collection {request.collection_name}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Collection creation failed: {str(e)}',
            extra={
                'endpoint': 'create_collection',
                'collection_name': request.collection_name,
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
