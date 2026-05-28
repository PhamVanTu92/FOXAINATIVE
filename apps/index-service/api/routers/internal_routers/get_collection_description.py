"""
Internal endpoint to get collection description for service-to-service communication.

No authentication required — accessible only within Docker network.
Used by Query service orchestrator to inject collection context into agent prompts.
"""
from __future__ import annotations

from api.helpers.dependencies.database import get_db_session
from api.helpers.exception_handler import ExceptionHandler
from app.colllections.get_collection_description import GetCollectionDescriptionInput
from app.colllections.get_collection_description import GetCollectionDescriptionService
from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from joint.logging import get_logger
from joint.utils import get_settings
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
settings = get_settings()

try:
    collection_description_service = GetCollectionDescriptionService(
        settings=settings.postgres,
    )
    logger.info('Collection description service initialized successfully')
except Exception as e:
    logger.error(
        f"Failed to initialize collection description service: {str(e)}",
    )
    raise RuntimeError(
        f"Collection description service initialization failed: {str(e)}",
    )


@router.get(
    '/collections/{collection_name}/description',
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary='Get collection description (internal)',
    description="""Internal endpoint for service-to-service communication.
Returns the description of a collection by its name.

Authentication: Not required (internal Docker network only)

Path Parameters:
- collection_name: Name of the collection

Success Response (200):
```json
{
  "message": "Process successfully !!!",
  "info": {
    "description": "Operator-configured knowledge base",
    "collection_name": "chatbot-foxai",
    "message": "Successfully retrieved description for collection 'chatbot-foxai'"
  }
}
```

Business Rules:
- Returns the description field from the collections table
- Collection is looked up by collection_name (exact match)
- Returns null description if collection not found

Common Errors:
- 404: Collection not found
- 500: Database connection or query failure""",
)
async def get_collection_description(
    collection_name: str,
    db: Session = Depends(get_db_session),
):
    """
    Get collection description by collection name.

    This internal endpoint is designed for service-to-service calls within
    the Docker network. No authentication required.

    Args:
        collection_name: Name of the collection to query.
        db: Database session from dependency injection.

    Returns:
        JSON with description and collection_name.
    """
    exception_handler = ExceptionHandler(
        logger=logger.bind(), service_name=__name__,
    )

    try:
        logger.info(
            f'Getting collection description - '
            f'collection_name={collection_name}',
        )

        service_input = GetCollectionDescriptionInput(
            collection_name=collection_name,
        )

        result = await collection_description_service.process(
            service_input, db,
        )

        if result.description is None and 'not found' in result.message.lower():
            return exception_handler.handle_bad_request(
                message=result.message,
                extra={
                    'endpoint': 'get_collection_description',
                    'collection_name': collection_name,
                },
            )

        logger.info(
            f'Collection description retrieved successfully - '
            f'collection_name={collection_name}',
        )
        return exception_handler.handle_success(
            output=result.model_dump(mode='json'),
        )

    except Exception as e:
        logger.error(
            f'Failed to get collection description - '
            f'collection_name={collection_name}: {str(e)}',
        )
        return exception_handler.handle_exception(
            e=f'Failed to retrieve collection description: {str(e)}',
            extra={
                'endpoint': 'get_collection_description',
                'collection_name': collection_name,
                'error': str(e),
            },
        )
