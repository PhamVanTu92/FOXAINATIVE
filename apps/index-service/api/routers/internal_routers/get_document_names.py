"""
Internal endpoint to list document names for service-to-service communication.

No authentication required — accessible only within Docker network.
Used by Query service orchestrator for document listing in RAG/comparison workflows.
"""
from __future__ import annotations

from typing import Optional

from api.helpers.dependencies.database import get_db_session
from api.helpers.exception_handler import ExceptionHandler
from app.documents.get_document_names import GetDocumentNamesInput
from app.documents.get_document_names import GetDocumentNamesService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    document_names_service = GetDocumentNamesService(
        settings=settings.postgres,
    )
    logger.info('Document names service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize document names service: {str(e)}",
    )
    raise RuntimeError(
        f"Document names service initialization failed: {str(e)}",
    )


@router.get(
    '/collections/{collection_name}/document-names',
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary='List document names in a collection (internal)',
    description="""Internal endpoint for service-to-service communication.
Returns distinct document display names for a given collection.

Authentication: Not required (internal Docker network only)

Path Parameters:
- collection_name: Name of the collection to query

Query Parameters:
- processing_status: Filter by processing status (default: completed)

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "document_names": ["policy_v1.pdf", "regulations_2026.pdf"],
    "total": 2,
    "message": "Successfully retrieved 2 document names"
  }
}
```

Business Rules:
- Returns only distinct document display_name values
- Draft documents are always excluded
- Default filter: only completed documents
- Results ordered alphabetically by display_name

Common Errors:
- 500: Database connection or query failure""",
)
async def get_document_names(
    collection_name: str,
    processing_status: Optional[str] = Query(
        'completed',
        description='Filter by processing status (default: completed)',
    ),
    db: Session = Depends(get_db_session),
):
    """
    List distinct document display names in a collection.

    This internal endpoint is designed for service-to-service calls within
    the Docker network. No authentication required.

    Args:
        collection_name: Name of the collection to query.
        processing_status: Filter by document processing status.
        db: Database session from dependency injection.

    Returns:
        JSON with document_names list and total count.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Getting document names - collection_name={collection_name}, '
            f'processing_status={processing_status}',
        )

        service_input = GetDocumentNamesInput(
            collection_name=collection_name,
            processing_status=processing_status,
        )

        result = await document_names_service.process(service_input, db)

        if not result.document_names and 'failed' in result.message.lower():
            return exception_handler.handle_exception(
                e=result.message,
                extra={
                    'endpoint': 'get_document_names',
                    'collection_name': collection_name,
                    'processing_status': processing_status,
                },
            )

        logger.info(
            f'Document names retrieved successfully - '
            f'total={result.total}, collection_name={collection_name}',
        )
        return exception_handler.handle_success(
            output=result.model_dump(mode='json'),
        )

    except Exception as e:
        logger.error(
            f'Failed to get document names - '
            f'collection_name={collection_name}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve document names: {str(e)}',
            extra={
                'endpoint': 'get_document_names',
                'collection_name': collection_name,
                'processing_status': processing_status,
                'error': str(e),
            },
        )
