from __future__ import annotations

from typing import Any
from typing import Optional
from uuid import UUID

from api.helpers.dependencies.collection_validation import get_collection_name_by_document_id
from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from api.helpers.response_samples import ChunkResponseSamples
from app.chunks import ChunkCreationInput
from app.chunks import ChunkCreationOutput
from app.chunks import ChunkCreationService
from fastapi import APIRouter
from fastapi import Body
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.settings.defaults import DEFAULT_EMBEDDING_PROVIDER
from joint.settings.defaults import DEFAULT_STORAGE_PROVIDER
from joint.utils import get_settings
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()


class CreateChunkRequest(BaseModel):
    """Request body for creating a chunk."""
    content: str
    chunk_index: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    is_enabled: bool = True


@router.post(
    '/documents/{document_id}/chunks',
    response_model=ChunkCreationOutput,
    responses=ChunkResponseSamples.create_chunk_responses(),
    status_code=status.HTTP_201_CREATED,
    summary='Create a new chunk for a document',
    description="""Create a new chunk and sync to Qdrant vector store with embedding.

Authentication: Required
- Header: Authorization: Bearer <access_token>
- Role: Manager

Path Parameters:
- document_id: UUID of the parent document

Request Body:
```json
{
  "content": "Chunk text content",
  "chunk_index": null,
  "metadata": {},
  "is_enabled": true
}
```

Validation Rules:
- content: Required, non-empty text
- chunk_index: Optional, auto-calculated if omitted (max + 1)
- metadata: Optional, arbitrary key-value pairs
- is_enabled: Optional, defaults to true

Success Response (201):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "message": "Chunk created successfully",
    "chunk_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Business Rules:
- Creates chunk in PostgreSQL first (generates chunk_id and qdrant_point_id)
- Then upserts to Qdrant with embedding
- Metadata is inherited from sibling chunks (source, document_name, etc.)
- chunk_index is auto-calculated as max(existing) + 1 if not provided

Common Errors:
- 400: Empty content or invalid metadata
- 401: Missing or invalid access token
- 403: Insufficient permissions (requires Manager role)
- 404: Document not found

Integration Notes:
- Store returned chunk_id for future chunk operations
- Chunk creation is synchronous and completes immediately
- Embedding is generated server-side using configured provider""",
)
async def create_chunk(
    document_id: UUID,
    body: CreateChunkRequest = Body(...),
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
) -> ChunkCreationOutput:
    """
    Create a new chunk for a document with Qdrant sync.

    This endpoint creates chunks:
    - User authentication is required (JWT token)
    - Document ID is specified in the URL path
    - Chunk is created in PostgreSQL and synced to Qdrant
    - Uses default embedding provider for vector generation

    **Authentication**:
    - Requires valid Bearer token (handled by dependency)
    - User must have manager role (handled by dependency)
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        # Get collection_name from document_id
        collection_name = get_collection_name_by_document_id(
            document_id=document_id, db=db,
        )

        # Initialize service with default providers
        service = ChunkCreationService(
            settings=settings,
            provider_storage=DEFAULT_STORAGE_PROVIDER,
            provider_embedding=DEFAULT_EMBEDDING_PROVIDER,
        )

        logger.info(
            f'Creating chunk for document: {document_id} '
            f'by user: {current_user.user_id}',
        )

        # Call the chunk creation service
        result = await service.process(
            ChunkCreationInput(
                document_id=document_id,
                collection_name=collection_name,
                user_id=current_user.user_id,
                content=body.content,
                chunk_index=body.chunk_index,
                metadata=body.metadata,
                is_enabled=body.is_enabled,
            ),
            db,
        )

        logger.info(f'Chunk creation completed for document: {document_id}')
        return exception_handler.handle_success(output=result.model_dump())

    except ValueError as e:
        logger.error(f'Invalid input for chunk creation: {str(e)}')
        return exception_handler.handle_bad_request(
            message=f'Invalid input: {str(e)}',
            extra={
                'endpoint': 'create_chunk',
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
                    'endpoint': 'create_chunk',
                    'document_id': str(document_id),
                    'user_id': str(current_user.user_id),
                },
            )

        # Other errors
        logger.error(
            f'Failed to create chunk for document {document_id}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Chunk creation failed: {str(e)}',
            extra={
                'endpoint': 'create_chunk',
                'document_id': str(document_id),
                'user_id': str(current_user.user_id),
                'error': str(e),
            },
        )
